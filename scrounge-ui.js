(function () {

  var Loader = "ajax"; // ajax | elt.load

  // How much to throttle repeated GETs to avoid getting blacklisted on w3.org:
  const DELAY = 250; // Set to 0 when running on localhost.
  var LastGet = 0;
  var Start = Date.now(); // for differential logging

  // Some display classes which can be set in the .html style:
  const COUNT = "count";
  const INDEX = "index";
  const KEY = "key";
  const VALUE = "value";
  const DONE = "done";
  const DOING = "doing";
  const RENDERED_RESULT = "block";

  $(document).ready(() => {
    $("#indexButton").click(() => {
      window.Scrounger.startCrawl(getInterface());
    });
  });
  function getInterface () {
    var rootIndex = {};
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
    function makeLogger (target, index) {
      var _results = $("<div class=\""+INDEX+"\"/>");
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
      _oldSet = index.set;
      index.set = function (key, value) {
        value = Object.keys(value).reduce((ret, k) => {
          var val = value[k];
          if (typeof val === "string")
            val = val.split(/\s+/);
          ret[k] = val.map(txt => {
            return txt.replace(/\s+/g, " ").replace(/</g, "&lt;");
          });
          return ret;
        }, {});
        _oldSet.call(index, key, value);
        var valsHTML = Object.keys(value).map(k => {
          return `<span class="key">${k}:</span> <span class="value">${value[k].join(" ")}</span>`;
        });
        _results.
          append($("<li><span class=\""+KEY+"\">"+key+":</span></li>")).
          append(" ").
          append($("<pre>" + valsHTML.join("\n") + "</pre>")).
          append($("<br/>")).
          append("\n");
        _count.text(parseInt(_count.text())+1);
      };
      index.fail = function (type, msg) {
        _results.
          append($("<span class=\""+KEY+"\">"+type+":</span>")).
          append(" ").
          append($("<span class=\""+VALUE+"\">"+msg+"</span>")).
          append($("<br/>")).
          append("\n");
        _count.text(parseInt(_count.text())+1);
      };
      index.target = target;
      var _ul = null;
      function _emit (klass, args) {
        var toAdd = $("<li/>").append(args.map(elt => {debugger;
          return elt.toString.apply(elt);
        }).join(" "));
        if (klass)
          toAdd.addClass(klass);
        if (_ul === null) {
          _ul = $("<ul/>");
          target.append(_ul);
        }
        _ul.append(toAdd);
        console.log.apply(console, args);
        return toAdd;
      }
      function _escape (s) {
        return s.toString().replace(/</g, "&lt;");
      }

      return {
        log: function log () {
          var args = [].slice.call(arguments).map(_escape);
          return _emit(null, args);
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
    var _queue = Scrounger.makeQueue(() => {
      $("#results").append(JSON.stringify(rootIndex, null, 2)+"\n");
      $("#indexButton").attr("class", DONE).prop("value", "Indexed");
    });
    var _get = function (url, f) {
      var _this = this;
      _queue.add(url);

        var nestedIndex = makeIndex();
      var logElt = _this.logHTML(`<a href="${url}">${url}</a>`);
        logElt.attr("class", "idle");
      var nestedInterface = Object.assign(
        makeLogger(logElt, nestedIndex),
        {
          logElt: logElt,
          get: _get
        });

      var now = Date.now();
      var nextGet = Math.max(Math.round(LastGet + DELAY), now);
      var delay = nextGet - now;
      LastGet = nextGet;
      setTimeout(() => {
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
            logElt.attr("class", "fail");
            nestedIndex.fail(textStatus, errorThrown);
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
        logElt.attr("class", "doing");
        f(nestedInterface, find, absolutize, url, nestedIndex);
        setTimeout(() => {
          logElt.attr("class", "done");
          _queue.finished(url);
        }, 0); // demo [class=doing]
      }
    }
    $("#indexButton").attr("class", DOING).prop("value", "Indexing");
    var logElt = $("#log");
    logElt.attr("class", "doing");
    return Object.assign(makeLogger(logElt, makeIndex()), {
      logElt: logElt,
      get: _get
    });
  }
})();
