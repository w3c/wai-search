// Implement the scrounge interface in a web page (scrounge.html).
// Compare with scrounge-cli which offers the same interface.

PerformSearch = (function () {

  // Ranking factors
  const CLUSTERQ = 16; // flatten 1/x curve
  const MATCHQ = 16; // nth word match is MATCHQ × more important than q.

  // Some display classes which can be set in the .html style:
  const VALUATION = "valuation";
  const FLAVORS = "flavors";
  const URL = "url";
  const TITLE = "title";
  const SKIP = "skip";
  const LEAD = "lead";
  const MATCH = "match";
  const TRAIL = "trail";

  // How much contextual text to include in results:
  const LEFT = 50;
  const RIGHT = 50;

  function performSearch (idx) {
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
          $("<blockquote/>");
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

  return performSearch;
})();
