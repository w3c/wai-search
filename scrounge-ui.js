(function () {
  // How much to throttle repeated GETs
  const DELAY = 0; // 3000;
  // classed in UI
  const COUNT = "count";
  const INDEX = "index";
  const KEY = "key";
  const VALUE = "value";

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
      var _count = $("<button class=\""+COUNT+"\">0</button>").on("click", function (evt) {
        _results.css("display", _results.css("display") === "table" ? "none" : "table");
      });
      target.append(" ").
        append(_count).
        append(_results);
      _oldSet = index.set;
      index.set = function (key, value) {
        _oldSet.call(index, key, value);
        _results.
          append($("<span class=\""+KEY+"\">"+key+":</span>")).
          append(" ").
          append($("<span class=\""+VALUE+"\">"+value+"</span>")).
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
    });
    var _get = function (url, f) {
      var _this = this;
      _queue.add(url);
      var elt = $("<div/>");
      setTimeout(() => {
      elt.load(url, function (data, status, jqXhr) {
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
        var nestedIndex = makeIndex();
        var nestedInterface = {
          log: makeLogger(_this.log(url), nestedIndex),
          get: _get
        };
        f(nestedInterface, find, absolutize, url, nestedIndex);
        _queue.finished(url);
      });
      }, DELAY*Math.random()); // cheasy throttling
    }
    return {
      log: makeLogger($("#log"), makeIndex()),
      get: _get
    };
  }
})();
