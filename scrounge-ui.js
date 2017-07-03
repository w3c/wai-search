// Implement the scrounge interface in a web page (scrounge.html).
// Compare with scrounge-cli which offers the same interface.

(function () {

  // ## User configuration ##
  // How much to throttle repeated GETs to avoid getting blacklisted on w3.org:
  const DELAY = 0; // Set to 0 to run unthrottled.
  const LOG_TO_CONSOLE = false; // mirror logged message to the console.

  // Ranking factors
  const CLUSTERQ = 16; // flatten 1/x curve
  const MATCHQ = 16; // nth word match is MATCHQ × more important than q.

  // Some display classes which can be set in the .html style:
  const COUNT = "count";
  const VALUATION = "valuation";
  const FLAVORS = "flavors";
  const URL = "url";
  const TITLE = "title";
  const LENGTH = "length";
  const INDEX = "index";
  const KEY = "key";
  const VALUE = "value";
  const SKIP = "skip";
  const LEAD = "lead";
  const MATCH = "match";
  const TRAIL = "trail";
  const DONE = "done";
  const DOING = "doing";
  const RENDERED_RESULT = "block";

  // How much contextual text to include in results:
  const LEFT = 50;
  const RIGHT = 50;


  // ## Mechanics ##
  var Loader = "ajax"; // how to load sub pages [ajax|elt.load]

  // Throtttling GET speed
  var LastGet = 0;
  var Start = Date.now(); // for differential logging
  var rootIndex = null;

  // Kick everything off with startCrawl.
  $(document).ready(() => {
    $("#targetList").empty();
    window.Scrounger.targetList.forEach(target => {
      var li = addTargetRow(null);
      li.find(".summary").empty().append(summarizeRule(stripComments(target.sr)));
      li.find(".rule").val(target.sr);
      li.find(".path").val(target.path);
      $("#targetList").append(li);

      function addTargetRow (evt) {
        var add = $('<button class="addTarget" title="add a target">+</button>');
        add.on("click", addTargetRow);
        var remove = $('<button class="removeTarget" title="remove this target">-</button>');
        remove.on("click", removeTargetRow);

        var _script = $("<textarea>").
            addClass("rule").addClass(INDEX).
            attr("spellcheck", "false").
            attr("rows", 10).
            css("width", "100%");
        var _expand = $("<button/>").
            append(summarizeRule("")).
            addClass("summary").addClass(COUNT).
            on("click", function (evt) {
              var nowShowing =_script.css("display") === RENDERED_RESULT;
              var newDisplay = nowShowing ? "none" : RENDERED_RESULT;
              if (nowShowing)
                _expand.empty().append(summarizeRule(stripComments(_script.val())));
              _script.css("display", newDisplay);
            });
        var li = $("<li/>").
            append(add, remove).
            append($("<input/>").addClass("path")).
            append(" ").
            append(_expand).
            append(_script);
        if (evt) {
          $(evt.target).parent().after(li);
        } else {
          $("#shapeMap").append(li);
        }

        if ($(".removeTarget").length === 1)
          $(".removeTarget").css("visibility", "hidden");
        else
          $(".removeTarget").css("visibility", "visible");

        return li;
      }

      function removeTargetRow (evt) {
        if (evt) {
          $(evt.target).parent().remove();
        } else {
          $(".target").remove();
        }
        if ($(".removeTarget").length === 1)
          $(".removeTarget").css("visibility", "hidden");
        return false;
      }

      function summarizeRule (rule) {
        if (!rule)
          return "create rule";
        try {
          var json = JSON.parse(rule);
          return $("<span/>").
            append("edit rule (").
            append($("<span/>").addClass(LENGTH).text(rule.match(/\n/g).length)).
            append(" lines)");
        } catch (e) {
          return $("<span/>").
            append("edit broken rule (").
            append($("<span/>").addClass("fail").text(e.toString())).
            append(")");
        }
      }
    });
    $("#search-input").
      on("blur", performSearch).
      on("keypress", evt => {
        if(evt.keyCode == 13) {
          performSearch(evt);
          return false;
        }
        return true;
      });
    $("#indexButton").click(() => {
      $("#log").append($("<h2/>").css("display", "inline").text("search index: "));
      var uiTargetList = $("#targetList li").map((idx, li) => {
        return {
          path: $(li).find("input").val(),
          sr: stripComments($(li).find("textarea").val())};
      }).get();
      window.Scrounger.startCrawl(getInterface(), uiTargetList);
      $("#clear").prop("disabled", false);
      $("#search-input").prop("disabled", false);
    }).prop("disabled", false);
    $("#clear").click(() => {
      $("#log").empty();
      $("#indexButton").attr("class", null).prop("value", "Index");
      $("#clear").prop("disabled", true);
      $("#search-input").prop("disabled", true);
    });
  });

  function performSearch (evt) {
    var idx = rootIndex.get();
    var search = $("#search-input").val().trim().toLowerCase();
    $("#search-results").empty();
    if (search.length === 0)
      return false;

    var searchers = getSearchers(search);
    var knownFlavors = [];
    // For every url in the index...
    var list = Object.keys(idx).reduce((allResults, url) => {
      // ... and every key like ".9,flavor1,flavor2"
      var bestForUrl = Object.keys(idx[url].flavors).reduce((bestForUrl, key) => {
        // For this URL and key, find the best match in all of it's text ranges.
        var forThisKey = bestMatchForTextArray(key, idx[url].flavors[key], searchers);
        return bestForUrl === null ? forThisKey :
          forThisKey === null || forThisKey.valuation > bestForUrl.valuation ? bestForUrl :
          forThisKey;
      }, null);
      if (bestForUrl === null)
        return allResults;
      bestForUrl.url = url;
      bestForUrl.title = idx[url].title;

      // Add any new flavors from this match.
      bestForUrl.flavors.forEach(flavor => {
        if (knownFlavors.indexOf(flavor) === -1)
          knownFlavors.push(flavor);
      });

      // Sort new result into allResults.
      for (var allResultsI = 0; allResultsI < allResults.length; ++allResultsI) {
        var cur = allResults[allResultsI];
        if (cur.valuation < bestForUrl.valuation) {
          allResults.splice(allResultsI, 0, bestForUrl);
          return allResults;
        }
      }
      // Sort in at bottom, i.e. append new result.
      return allResults.concat(bestForUrl);
    }, []);
    $("#search-flavors").empty().append(
      knownFlavors.map(flavor => {
        return $("<li/>").
          append(
            $('<label />', { 'for': 'cb_'+flavor, text: flavor }),
            $('<input />', { type: 'checkbox', id: 'cb_'+flavor,
                             value: flavor}).
              on("click", redraw),
            "<br/>",
            $("<button/>", { text: "only" }).
              on("click", evt => {
                $("#search-flavors input").prop('checked', false);
                $(evt.target).parent().find("input").prop('checked', true);
                return redraw(evt);
              })
          );
      })
    );
    $("#search-results").append(
      list.length > 0 ?
        buildResults(list) :
        $("<span/>").addClass("fail").
        text("Your search for \"" + search + "\" didn't match anything in the database."));
    return false;

  }

  function redraw (evt) {
    var flavors = $("#search-flavors input:checked").map((idx, elt) => {
      return $(elt).val();
    }).get();
    if (flavors.length === 0) {
      $("#search-results li").show();
      return true;
    }
    $("#search-results li").each((idx, li) => {
      var liFlavors = $(li).attr("data-flavors").split(/,/);
      if (flavors.filter(flavor => {
        return liFlavors.indexOf(flavor) !== -1;
      }).length > 0)
        $(li).show();
      else
        $(li).hide();
    });
    return true;
  }

  function buildResults (list) {
    return list.map(entry => {
      var blockquote =
          $("<blockquote/>").
          addClass(VALUE);
      entry.text.summary.forEach(text => {
        blockquote.
          append(text.gap ?
                 $("<span/>").
                 addClass(SKIP).
                 text("…") :
                 "").
          append($("<span/>").
                 addClass(LEAD).
                 text(text.lead)).
          append($("<span/>").
                 addClass(MATCH).
                 text(text.match)).
          append($("<span/>").
                 addClass(TRAIL).
                 text(text.trail));
      });
      return $("<li/>").
        attr("data-flavors", entry.flavors.join(",")).
        append($("<h2/>").
               addClass(TITLE).
               append($("<a/>").
                      attr("href", entry.url).
                      text(entry.title.trim()))).
        append(" ").
        append($("<span/>").
               addClass(VALUATION).
               text(entry.q + "·" + entry.text.cluster + "⇒" + entry.valuation)).
        append(" ").
        append($("<span/>").
               addClass(FLAVORS).
               text(entry.flavors)).
        append(" ").
        append(blockquote).
        append($("<a/>").
               attr("href", entry.url).
               addClass(URL).
               text(entry.url));
    })
  }

  // Parse searchString into a list of words to search for.
  function getSearchers (searchString) {
    return searchString.trim().split(/ /).map(s => {
      var singular = s, plural = s;
      if (s.endsWith("y"))
        plural = s.substr(0, s.length-1) + "ies";
      else if (s.endsWith("ies"))
        singlular = s.substr(0, s.length-3) + "y";
      else if (s.endsWith("s"))
        singular = s.substr(0, s.length-1);
      else
        plural = s + "s";

      return {
        goal: s,
        search: (text) => {
          return [singular, plural].reduce((terms, term) => {
            var indexes = indexesOf(text, term);
            return indexes.length > 0 ?
              terms.concat(indexes.map(i => { return { term: term, index: i }; })) :
            terms;
          }, [])
        },
      };
    });
  }

  // For a sequence of strings, e.g. ["mississippi", "is", "pi"],
  // find the most clustered index for search text, e.g. ["s", "i", "p"]
  function bestMatchForTextArray (key, textArray, searchers) {
    var match = textArray.reduce((match, text) => {
      var m = bestMatchForText(text, searchers);
      return m === null || m.cluster <= match.cluster ? match : m;
    }, {cluster: 0, summary: null});
    if (match.summary === null)
      // We have no matches on this combination of quality and flavors.
      return null;

    // Parse key into quality and flavors.
    var flavors = key.split(/,/);
    var q = flavors.shift();
    var valuation = (parseFloat(q) + MATCHQ*match.cluster)/(MATCHQ + 1);
    // console.log(q, match.cluster, valuation);

    // Create a new result.
    return {
      q: q,
      flavors: flavors,
      text: match,
      valuation: valuation
    };
  }

  // For a given sequence of text e.g. "mississippi",
  // find the most clustered indexes for searchers, e.g. ["s", "i", "p"]
  function bestMatchForText (text, searchers) {
    var matches = searchers.reduce((matches, s) => {
      return matches.concat([s.search(text)]);
    }, []);
    limitMatches(matches, 10000); // (non-functional) trim cross-product space.

    // Find the best clustering for the search matches in this text.
    var xp = crossProduct(matches);
    var bestIndexes = null, bestClustering = 0;
    while (xp.next()) {
      var selections = xp.get();
      var clustering = getClustering(selections);
      if (clustering > bestClustering) {
        bestClustering = clustering;
        bestIndexes = selections.slice();
      }
    }

    return bestIndexes === null ?
      null :
      {
        cluster: bestClustering,
        summary: summarize(bestIndexes, text, searchers)
      }
  }

  // Capture the strings matched by searchers over text.
  function summarize (indexes, text, searchers) {
    var missed = indexes.reduce((missed, m, idx) => {
      return !m ? missed.concat(searchers[idx].goal) : missed;
    }, []);
    var sorted = indexes.filter(m => {
      return !!m;
    }).sort((l, r) => {
      return cmp(l.index, r.index);
    });
    var length = text.length;
    var to = null; // where we got to in previous iterations
    var last = null; // need to update last.trail when there's an overlap.
    return sorted.map((m, mNo) => {
      var from = m.index < LEFT ? 0 : m.index - LEFT;
      while (from > 0 && text[from-1] !== " ")
        from--;

      var gap;
      if (to === null) {
        gap = false;
      } else if (from === to) {
        gap = false;
      } else if (from < to) {
        gap = false;
        from = m.index;
        // Make the last.trail end at m.index.
        var lastM = sorted[mNo - 1];
        last.trail = text.substr(lastM.index + lastM.term.length,
                                 m.index - lastM.index - lastM.term.length);
      } else {
        gap = true;
      }

      to = m.index + m.term.length + RIGHT > text.length ?
          text.length :
          m.index + m.term.length + RIGHT;
      while (to < text.length && text[to] !== " ")
        to++;

      last = {
        gap: gap,
        lead: text.substr(from, m.index - from),
        match: text.substr(m.index, m.term.length),
        trail: text.substr(m.index + m.term.length, to - m.index - m.term.length)
      };
      return last;
    });
  }

  /** cmp = handy sort predicate from perl
   */
  function cmp (l, r) {
    return l < r ? -1 : l > r ? 1 : 0;
  }

  /** limitMatches - limit the cross product of matches to limit permutations.
   * If the product is over limit, halve the longest member of matches and try again.
   */
  function limitMatches (matches, limit) {
    var product = matches.reduce((product, m) => {
      return m.length === 0 ? product : m.length * product;
    }, 1);
    while (product > limit) {
      // console.log("" + product + "=" + matches.map(m => { return m.length; }).join("×"));
      var largest = matches.reduce((largest, m) => {
        return m.length > largest.length ? m : largest;
      }, []);
      largest = largest.splice(largest.length / 2);
      product = matches.reduce((product, m) => {
        return m.length === 0 ? product : m.length * product;
      }, 1)
    }
    // console.log("" + product + "=" + matches.map(m => { return m.length; }).join("×"));
  }

  // Given an array of indexes [{index: 2}, {index: 5}, {index: 9}],
  // Calculate a clustering coefficient < 1 which is closer to one for a highly
  // clustered array e.g. [{index: 1}, {index: 2}, {index: 3}]
  function getClustering (indexes) {
    // 1/4 -> .25, 2/4 -> .25 + .25clusterQ, 3/4 -> .5 + .25clusterQ, 4/4 -> .75 + .25clusterQ
    var sorted = indexes.filter(m => {
      return !!m;
    }).sort((l, r) => {
      return cmp(l.index, r.index);
    });
    if (sorted.length === 1)
      return 1/indexes.length;
    var step = 1 / indexes.length;
    var clusterQ = 0;
    for (var i = 1; i < sorted.length; ++i)
      clusterQ += 1/((sorted[i].index - sorted[i-1].index)/CLUSTERQ + 1);
    return (sorted.length - 1) * step + clusterQ * step;
  }

  // all indexs of text in s.
  // ("ab", "abcabc") => [0, 3]
  function indexesOf (text, s) {
    var ret = [];
    for (var i = 0; ; ) {
      var t = text.indexOf(s, i);
      if (t === -1)
        break;
      ret.push(t);
      i = t + 1;
    }
    return ret;
  }

  // Strip javascript-style (//) comments
  function stripComments (s) {
    return s.replace(/^\s*\/\/.*$/gm, "");
  }

  // Get interface shared with scrounge-cli.
  function getInterface () {
    // We will create nested indexes as we recurse through pages and
    // their set calls will update the rootIndex.
    rootIndex = makeIndex();

    // Create a GET queue.
    var _queue = window.Scrounger.makeQueue(() => {
      // done() callback: update classes
      console.log("done indexing");
      $("#indexButton").attr("class", DONE).prop("value", "Indexed");
      $("#log").removeClass("doing").addClass("done").append("<hr/>");
      console.log(rootIndex.get());
    });

    // Update the index button.
    $("#indexButton").attr("class", DOING).prop("value", "Indexing");

    // Shared interface includes logging functions and get.
    var logElt = $("#log");
    logElt.attr("class", "doing");
    return Object.assign(makeLogger(logElt, rootIndex), {
      logElt: logElt,
      get: get
    });

    // Create data structure for indexing pages.
    function makeIndex () {
      var myIndex = {  };
      return {
        set4: function (url, flavors, quality, values) {
          merge(myIndex, url, flavors, quality, values);
          if (this !== rootIndex)
            rootIndex.set4(url, flavors, quality, values);
        },
        setTitle: function (url, title) {
          if (!(url in myIndex))
            myIndex[url] = {title: null, flavors: {}};
          myIndex[url].title = title;
          if (this !== rootIndex)
            rootIndex.setTitle(url, title);
        },
        get: function () {
          return myIndex;
        }
      };

      // function merge (index, key, values) {
      function merge (index, url, flavors, quality, values) {
        var key = [quality.toString()].concat(flavors).join(",");
        if (url in index) {
          if (key in index[url].flavors)
            index[url].flavors[key] = index[url].flavors[key].concat(values);
          else
            index[url].flavors[key] = values;
        } else {
          var t = {title: null, flavors: {}};
          t.flavors[key] = values;
          index[url] = t;
        }
      }
    }

    // Create logger interface with log, error API.
    // logHMTL is used only by scrounge-ui; it has no parallel in scrounge-cli.
    function makeLogger (target, index) {
      var _results = $("<ul/>").addClass(INDEX);
      var _count = $("<button/>").addClass(COUNT).text("0").
          on("click", function (evt) {
            var newDisplay = _results.css("display") === RENDERED_RESULT ?
                "none" :
                RENDERED_RESULT;
            _results.css("display", newDisplay);
          });
      target.append(" ").
        append(_count).
        append(_results);

      // Override index.set to paint <li/>s into the UI's INDEX.
      var _oldSet = index.set4;
      index.set4 = function (url, flavors, quality, values) {
        var key = [quality.toString()].concat(flavors).join(",");

        // Propagate set call to inherited settter.
        _oldSet.call(index, url, flavors, quality, values);

        // Paint index entry in HTML.
        _results.
          append($("<li/>").addClass("log").
                 append($("<span/>").addClass(KEY).text(url)).
                 append(" ").
                 append($("<span/>").addClass(KEY).text(quality)).
                 append(" [").
                 append($("<span/>").addClass(KEY).text(flavors)).
                 append("]: ").
                 append($("<div/>").
                        addClass(VALUE).
                        append(values.map(v => {
                          return $("<span/>").
                            addClass("region").
                            text(v);
                        }))).
                 append("\n") /* for sane view source */);
        _count.text(parseInt(_count.text())+1);
      };

      // Display errors like 404s.
      index.fail = function (heading, msg) {
        _results.
          append($("<li/>").addClass("fail").
                 append($("<span/>").addClass(KEY).text(heading + ":")).
                 append(" ").
                 append($($("<pre/>").
                          addClass(VALUE).
                          text(msg))).
                 append("\n") /* for sane view source */
                ).closest("li").addClass("fail");
        _count.text(parseInt(_count.text())+1);
      };

      // Remember which element displays this log.
      index.target = target;

      // Paint <li/> into target's <ul/>.
      var _ul = null;
      function _emit (klass, args) {
        var toAdd = $("<li/>").append($("<div/>").append(args.map(elt => {
          return elt.toString.apply(elt);
        }).join(" ")));
        if (klass)
          toAdd.addClass(klass);
        if (_ul === null) {
          // We're logging the first message to this target.
          _ul = $("<ul/>");
          target.append(_ul);
        }
        _ul.append(toAdd);
        if (LOG_TO_CONSOLE)
          console.log.apply(console, args);
        return toAdd;
      }
      function _escape (s) {
        return s.toString().replace(/</g, "&lt;");
      }

      // Return the logging interface of iface.
      // Note that logHTML is private to scrounge-ui.
      return {
        log: function log () {
          var args = [].slice.call(arguments).map(_escape);
          return _emit("log", args);
        },
        logHTML: function log () {
          var args = [].slice.call(arguments);
          return _emit(null, args);
        },
        // error: function () {
        //   var args = [].slice.call(arguments).map(_escape);
        //   return _emit("fail", args);
        // }
      };
    };

    /* iface's get function:
       1 create a nested index to record associated index entries.
       2 create a nested interface to manipulate and display that index.
       3 throttle GETs
       4 perform GET (by ajax or element.load)
       5 invoke associated callback (f) with
           nested interface,
           jQuery access to loaded element
           relative URL resolver
           the GOTten URL
           nested index.
    */
    function get (url, f) {
      var _this = this;
      _queue.add(url);

      // 1 create a nested index to record associated index entries.
      var nestedIndex = makeIndex();
      var logElt = _this.logHTML(`<a href="${url}">${url}</a>`);
      logElt.attr("class", "idle"); // display pending requests.

      // 2 create a nested interface to manipulate and display that index.
      var nestedInterface = Object.assign(
        makeLogger(logElt, nestedIndex),
        {
          logElt: logElt,
          get: get
        });

      // 3 throttle GETs
      var now = Date.now();
      var nextGet = Math.max(Math.round(LastGet + DELAY), now);
      var delay = nextGet - now;
      LastGet = nextGet;
      setTimeout(() => {
        // 4 perform GET (by ajax or element.load)
        if (Loader === "elt.load") {
          var elt = $("<div/>");
          elt.load(url, function (data, status, jqXhr) {
            invokeCallback(elt);
          });
        } else  if (Loader === "ajax") {
          $.ajax({
            method: 'get',
            url: url,
            dataType: 'text'
          }).then(function (data, status, jqXhr) {
            var elt = $("<div>" + data.
                        // replace(/[\S\s]*?<body/, '<div').
                        // replace(/<\/body>[\S\s]*$/, '</div>').
                        replace(/src=/g, "src999=") // don't GET images.
                        + "</div>"
                       );
            invokeCallback(elt);
          }).fail(function (jqXHR, textStatus, errorThrown) {
            nestedIndex.fail("GET " + textStatus, errorThrown);
            _queue.finished(url);
          });
        } else {
          throw "unrecognized loader: " + Loader;
        }
      }, delay); // Wait for next slot to send request.

      function invokeCallback (elt) {
        // would like to return a simple HTML object.
        function find () {
          return elt.find.apply(elt, [].slice.call(arguments));
        }
        function absolutize (rel) {
          d = document.implementation.createHTMLDocument();
          b = d.createElement('base');
          d.head.appendChild(b);
          a = d.createElement('a');
          d.body.appendChild(a);
          b.href = url;
          a.href = rel;
          return a.href;
        }
        logElt.removeClass("idle").addClass("doing");
        // 5 invoke associated callback (f) with
        //     nested interface,
        //     jQuery access to loaded element
        //     relative URL resolver
        //     the GOTten URL
        //     nested index.
        f(nestedInterface, find, absolutize, url, nestedIndex);
        setTimeout(() => {
          logElt.
            removeClass("doing").
            addClass("done");
          _queue.finished(url);
        }, 0); // demo [class=doing]
      }
    }
  }

  // based on
  // http://stackoverflow.com/questions/9422386/lazy-cartesian-product-of-arrays-arbitrary-nested-loops
  function crossProduct(sets) {
    var n = sets.length, carets = [], args = null;

    function init() {
      args = [];
      for (var i = 0; i < n; i++) {
        carets[i] = 0;
        args[i] = sets[i][0];
      }
    }

    function next() {

      // special case: crossProduct([]).next().next() returns false.
      if (args !== null && args.length === 0)
        return false;

      if (args === null) {
        init();
        return true;
      }
      var i = n - 1;
      carets[i]++;
      if (carets[i] < sets[i].length) {
        args[i] = sets[i][carets[i]];
        return true;
      }
      while (carets[i] >= sets[i].length) {
        if (i == 0) {
          return false;
        }
        carets[i] = 0;
        args[i] = sets[i][0];
        carets[--i]++;
      }
      args[i] = sets[i][carets[i]];
      return true;
    }

    return {
      next: next,
      do: function (block, _context) { // old API
        return block.apply(_context, args);
      },
      // new API because
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments#Description
      // cautions about functions over arguments.
      get: function () { return args; }
    };
  }


})();
