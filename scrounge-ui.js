// Implement the scrounge interface in a web page (scrounge.html).
// Compare with scrounge-cli which offers the same interface.

(function () {

  // ## User configuration ##
  // How much to throttle repeated GETs to avoid getting blacklisted on w3.org:
  const DELAY = 250; // Set to 0 when running on localhost.
  const LOG_TO_CONSOLE = false; // mirror logged message to the console.
  // Some display classes which can be set in the .html style:
  const COUNT = "count";
  const LENGTH = "length";
  const INDEX = "index";
  const KEY = "key";
  const VALUE = "value";
  const DONE = "done";
  const DOING = "doing";
  const RENDERED_RESULT = "block";


  // ## Mechanics ##
  var Loader = "ajax"; // how to load sub pages [ajax|elt.load]

  // Throtttling GET speed
  var LastGet = 0;
  var Start = Date.now(); // for differential logging

  // Kick everything off with startCrawl.
  $(document).ready(() => {
    $("#targetList").empty();
    window.Scrounger.targetList.forEach(target => {
      var li = addTargetRow(null);
      li.find(".summary").empty().append(summarizeRule(target.sr));
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
                _expand.empty().append(summarizeRule(_script.val()))
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
    $("#indexButton").click(() => {
      $("#log").append($("<h2/>").css("display", "inline").text("search index: "));
      var uiTargetList = $("#targetList li").map((idx, li) => {
        return {
          path: $(li).find("input").val(),
          sr: $(li).find("textarea").val()};
      }).get();
      window.Scrounger.startCrawl(getInterface(), uiTargetList);
      $("#clear").prop("disabled", false);
    }).prop("disabled", false);
    $("#clear").click(() => {
      $("#log").empty();
      $("#indexButton").attr("class", null).prop("value", "Index");
      $("#clear").prop("disabled", true);
    });
  });

  // Get interface shared with scrounge-cli.
  function getInterface () {
    // We will create nested indexes as we recurse through pages and
    // their set calls will update the rootIndex.
    var rootIndex = makeIndex();

    // Create a GET queue.
    var _queue = window.Scrounger.makeQueue(() => {
      $("#indexButton").attr("class", DONE).prop("value", "Indexed");
      $("#log").removeClass("doing").addClass("done").append("<hr/>");
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
      var vals = {  };
      return {
       set: function (key, value) {
          merge(vals, key, value);
          if (this !== rootIndex)
            rootIndex.set(key, value);
        },
        get: function () {
          return vals;
        }
      };

      function merge (index, key, values) {
        if (key in index) {
          Object.keys(values).forEach(k => {
            if (k in index[key])
              index[key][k] = index[key][k].concat(values[k]);
            else
              index[key][k] = values[k];
          });
        } else {
          index[key] = values;
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
      _oldSet = index.set;
      index.set = function (key, value) {

        // Encode indexed strings for display.
        value = Object.keys(value).reduce((ret, k) => {
          var val = value[k];
          if (typeof val === "string")
            // val = val.split(/\s+/);
            val = [val];
          ret[k] = val.map(txt => {
            // TODO: move .replace to valsHTML?
            return txt.replace(/\s+/g, " ").replace(/</g, "&lt;");
          });
          return ret;
        }, {});

        // Propagate set call to inherited settter.
        _oldSet.call(index, key, value);

        // Paint index entry in HTML.
        var valsHTML = Object.keys(value).map(k => {
          return $("<span/>").
            append($("<span/>").addClass("key").text(k)).
            append(" ").
            append($("<span/>").addClass("value").text(value[k].join(" ")));
        });
        _results.
          append($("<li/>").addClass("log").
                 append($("<span/>").addClass(KEY).text(key + ":")).
                 append(" ").
                 append($("<pre/>").append(valsHTML)).
                 append("\n") /* for sane view source */);
        _count.text(parseInt(_count.text())+1);
      };

      // Display errors like 404s.
      index.fail = function (heading, msg) {
        _results.
          append($("<li/>").addClass("fail").
                 append($("<span/>").addClass(KEY).text(heading + ":")).
                 append(" ").
                 append($($("<pre/>").addClass(VALUE).text(msg))).
                 append("\n") /* for sane view source */
                ).closest("li").addClass("fail");
        _count.text(parseInt(_count.text())+1);
      };

      // Remember which element displays this log.
      index.target = target;

      // Paint <li/> into target's <ul/>.
      var _ul = null;
      function _emit (klass, args) {
        var toAdd = $("<li/>").append($("<pre/>").append(args.map(elt => {
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
})();
