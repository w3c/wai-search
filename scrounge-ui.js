(function () {
  $(document).ready(() => {
    $("#indexButton").click(() => {
      window.Scrounger.index(getInterface());
    });
  });
  function getInterface () {
    var _resourceText = {  };
    var makeLogger = function (target) {
      return function () {
        var args = [].slice.call(arguments);
        target.append(args.map(elt => {
          return elt.toString.apply(elt);
        }).join(" ") + "\n");
        console.log.apply(console, args);
      };
    };
    var _queue = Scrounger.makeQueue(() => {
      $("#results").append(JSON.stringify(_resourceText, null, 2)+"\n");
    });
    var _get = function (url, f) {
      var _this = this;
      _queue.add(url);
      var elt = $("<div/>");
      return elt.load(url, function (data, status, jqXhr) {
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
        f({ log: makeLogger($("#log")), get: _get }, find,
          absolutize, url, _resourceText);
        _queue.finished(url);
      });
    }
    return {
      log: makeLogger($("#log")),
      get: _get
    };
  }
})();
