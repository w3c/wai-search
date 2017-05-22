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
          vals[key] = value;
          rootIndex[key] = value;
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
      return function () {
        var args = [].slice.call(arguments);
        var toAdd = $("<li>" + args.map(elt => {
          return elt.toString.apply(elt);
        }).join(" ") + "</li>");
        if (_ul === null) {
          _ul = $("<ul/>");
          target.append(_ul);
        }
        _ul.append(toAdd);
        console.log.apply(console, args);
        return toAdd;
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
      var logElt = _this.log(`<a href="${url}">${url}</a>`);
        logElt.attr("class", "idle");
        var nestedInterface = {
          log: makeLogger(logElt, nestedIndex),
          logElt: logElt,
          get: _get
        };

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
    return {
      log: makeLogger(logElt, makeIndex()),
      logElt: logElt,
      get: _get
    };
  }
})();
