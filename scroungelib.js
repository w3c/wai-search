(function () {
  var Site = "http://localhost/";
  // var Site = "https://www.w3.org/";

  function index1 (iface) {
    iface.get('http://localhost/foo.html', foo);
    function foo (err, jQuery, getAbs, resourceText) {
      resourceText["foo"] = jQuery.find("#id1").text();
    }
  }
  function index (iface) {
    [
      { path: "WAI/perspectives/", func: parsePerspectives },
      { path: "WAI/tutorials/", func: parseTutorials },
      // { path: "WAI/bcase/", func: parseBCase },
    ].forEach(g => {
      var url = Site+g.path;
      iface.get(url, g.func);
    });

    function parsePerspectives (err, jQuery, getAbs, resourceText) {
      var videoPages = jQuery(".video-listing li");
      iface.log("scraping", videoPages.length, "video pages:");
      videoPages.each((idx, li) => {
        var perspectiveName = jQuery(li).find("a").attr("href");
        var perspectivePageUrl = getAbs(perspectiveName);

        iface.get(
          perspectivePageUrl,
          function (err, jQuery, getAbs, resourceText) {
            var desc = jQuery("meta[name=description]").attr("content").
                replace(/^Short? +video +about +/, "").
                replace(/ - what (is it|are they).*/, "").
                replace(/ for web accessibility$/, "");
            resourceText[perspectivePageUrl] = desc;
          }
        );
      });
    }
    function parseTutorials (err, jQuery, getAbs, resourceText) {
      var videoPages = jQuery("ul.topics li");
      iface.log("scraping", videoPages.length, "video pages:");
      videoPages.each((idx, li) => {
        var relativeName = jQuery(li).find("a").attr("href");
        var pageURL = getAbs(relativeName);
        iface.log(pageURL);
        iface.get(
          pageURL,
          function (err, jQuery, getAbs, resourceText) {
            var subPages = jQuery("ul[aria-labelledby=list-heading-tutorials] li");
            iface.log(subPages.length, "sub-pages"); // , subPages.find("a").attr("href").get().join(",")
            subPages.each((idx, li) => {
              var tutorialName = jQuery(li).find("a").attr("href");
              var tutorialPageUrl = getAbs(tutorialName);

              iface.get(
                tutorialPageUrl,
                function (err, jQuery, getAbs, resourceText) {
                  var headings = jQuery("h2");
                  // iface.log(tutorialPageUrl, headings.length);
                  var desc = headings.map((idx, h) => { return jQuery(h).text(); }).get().join(" ");
                  resourceText[tutorialPageUrl] = desc;
                }
              );
            });
          }
        );
      });
    }
    function parseBCase (err, jQuery, getAbs, resourceText) {
      var videoPages = jQuery(".hmenuselection li");
      iface.log("scraping", videoPages.length, "bcase pages:");
      videoPages.each((idx, li) => {
        var perspectiveName = jQuery(li).find("a").attr("href");
        var perspectivePageUrl = getAbs(perspectiveName);

        iface.get(
          perspectivePageUrl,
          function (err, jQuery, getAbs, resourceText) {
            var desc = jQuery("meta[name=description]").attr("content").
                replace(/^Short? +video +about +/, "").
                replace(/ - what (is it|are they).*/, "").
                replace(/ for web accessibility$/, "");
            resourceText[perspectivePageUrl] = desc;
          }
        );
      });
    }
  }
  function makeQueue (done) {
    var todo = 0;
    return {
      add: function (url) {
        ++todo;
      },
      finished: function (url) {
        if (--todo === 0)
          done();
      }
    };
  }
  var exportMe = {
    makeQueue: makeQueue,
    index: index
  };
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = exportMe;
  else
    window.Scrounger = exportMe;
})();

