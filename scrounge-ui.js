// Implement the scrounge interface in a web page (scrounge.html).
// Compare with scrounge-cli which offers the same interface.

(function () {

  // ## User configuration ##
  // How much to throttle repeated GETs to avoid getting blacklisted on w3.org:
  const DELAY = 250; // Set to 0 when running on localhost.
  const LOG_TO_CONSOLE = false; // mirror logged message to the console.
  // Some display classes which can be set in the .html style:
  const COUNT = "count";
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
    $("#indexButton").click(() => {
      window.Scrounger.startCrawl(getInterface());
    });
  });

  // Get interface shared with scrounge-cli.
  function getInterface () {
    // We will create nested indexes as we recurse through pages and
    // their set calls will update the rootIndex.
    var rootIndex = {};

    // Create a GET queue.
    var _queue = Scrounger.makeQueue(() => {
      $("#results").append(JSON.stringify(rootIndex, null, 2)+"\n");
      $("#indexButton").attr("class", DONE).prop("value", "Indexed");
    });

    // Update the index button.
    $("#indexButton").attr("class", DOING).prop("value", "Indexing");

    // Shared interface includes logging functions and get.
    var logElt = $("#log");
    logElt.attr("class", "doing");
    return Object.assign(makeLogger(logElt, makeIndex()), {
      logElt: logElt,
      get: get
    });

    // Create data structure for indexing pages.
    function makeIndex () {
      var vals = {  };
      return {
        set: function (key, value) {
          merge(vals, key, value);
          merge(rootIndex, key, value);
          function merge (index, key, values, flavors) {
            if (key in index) {
              Object.keys(value).forEach(k => {
                if (k in index[key])
                  index[key][k] = index[key][k].concat(values[k]);
                else
                  index[key][k] = values[k];
              });
            } else {
              index[key] = value;
            }
          }
        },
        get: function () {
          return vals;
        }
      };
    }

    // Create logger interface with log, error API.
    // logHMTL is used only by scrounge-ui; it has no parallel in scrounge-cli.
    function makeLogger (target, index) {
      var _results = $("<ul class=\""+INDEX+"\"/>");
      var _count = $("<button class=\""+COUNT+"\">0</button>").
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
            val = val.split(/\s+/);
          ret[k] = val.map(txt => {
            // TODO: move .replace to valsHTML?
            return txt.replace(/\s+/g, " ").replace(/</g, "&lt;");
          });
          return ret;
        }, {});

        // Propagate set call to inherited settter.
        _oldSet.call(index, key, value);

        // Paint HTML results.
        var valsHTML = Object.keys(value).map(k => {
          return `<span class="key">${k}:</span> <span class="value">${value[k].join(" ")}</span>`;
        });
        _results.
          append($("<li/>").addClass("log").
                 append("<span class=\""+KEY+"\">"+key+":</span>").
                 append(" ").
                 append($("<pre>" + valsHTML.join("\n") + "</pre>")).
                 append($("<br/>")).
                 append("\n") /* for sane view source */);
        _count.text(parseInt(_count.text())+1);
      };

      // Display errors like 404s.
      index.fail = function (heading, msg) {
        _results.
          append($("<li/>").addClass("fail").
                 append("<span class=\""+KEY+"\">"+heading+":</span>").
                 append(" ").
                 append($("<pre class=\""+VALUE+"\">"+msg+"</pre>")).
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
        error: function () {
          var args = [].slice.call(arguments).map(_escape);
          return _emit("fail", args);
        }
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
          logElt.removeClass("doing").
            addClass("done");
          _queue.finished(url);
        }, 0); // demo [class=doing]
      }
    }
  }
})();
