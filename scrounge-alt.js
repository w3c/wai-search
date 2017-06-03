// alternative approach: build custom js functions

  var TargetList = [
    { path: "WAI/perspectives/", func: parsePerspectives },
    { path: "WAI/tutorials/", func: parseTutorials },
    { path: "WAI/bcase/", func: parseBCase },
  ];

  /**
   * page parsers
   */
  function parsePerspectives (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery(".video-listing li");
    iface.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var perspectiveName = jQuery(li).find("a").attr("href");
      var perspectivePageUrl = getAbs(perspectiveName);

      iface.get(
        perspectivePageUrl,
        function (iface, jQuery, getAbs, url, index) {
          var desc = jQuery("meta[name=description]").attr("content").
              replace(/^Short? +video +about +/, "").
              replace(/ - what (is it|are they).*/, "").
              replace(/ for web accessibility$/, "");
          index.set(perspectivePageUrl, {
            1: desc
          });
        }
      );
    });
  }

  function parseTutorials (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery("ul.topics li");
    iface.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var relativeName = jQuery(li).find("a").attr("href");
      var pageURL = getAbs(relativeName);
      iface.get(
        pageURL,
        function (iface, jQuery, getAbs, url, index) {
          var subPages = jQuery("ul[aria-labelledby=list-heading-tutorials] li")
          //              .filter((_, elt) => { return $(elt).find("a").length > 0; })
          ;
          iface.log(subPages.length, "sub-pages"); // , subPages.find("a").attr("href").get().join(",")
          subPages.each((idx, li) => {
            var tutorialName = jQuery(li).find("a").attr("href");
            var tutorialPageUrl = getAbs(tutorialName);

            iface.get(
              tutorialPageUrl,
              function (iface, jQuery, getAbs, url, index) {
                var headings = jQuery("h2");
                // iface.log(tutorialPageUrl, headings.length);
                var desc = headings.map((idx, h) => {
                  return jQuery(h).text();
                }).get();
                index.set(tutorialPageUrl, { 1: desc });
              }
            );
          });
        }
      );
    });
  }

  function parseBCase (iface, jQuery, getAbs, url, index) {
    var videoPages = jQuery("li.listspaced");
    index.set(url, {
      1: videoPages.text()
    });
    iface.log("scraping", videoPages.length, "bcase pages:");
    videoPages.each((idx, li) => {
      var bCaseName = jQuery(li).find("a").attr("href");
      var bCasePageUrl = getAbs(bCaseName);

      iface.get(
        bCasePageUrl,
        function (iface, jQuery, getAbs, url, index) {
          var sections = jQuery("h2 a").parent();
          var theRest = sections.nextAll().not(sections);
          index.set(bCasePageUrl, {
            0: sections.map((i, e) => {
              return jQuery(e).text();
            }).get(),
            1: theRest.map((i, e) => {
              return jQuery(e).text();
            }).get()
          });
        }
      );
    });
  }

