(function () {
  // var Site = "https://www.w3.org/";
  // var Site = "http://90.9.146.48/";
  var Site = "http://localhost/";

  function startCrawl (iface) {
    [
      { path: "WAI/perspectives/", func: parsePerspectives },
      { path: "WAI/perspectives/", func: parseDirected },
      { path: "WAI/tutorials/", func: parseTutorials },
      { path: "WAI/bcase/", func: parseBCase },
      { path: "WAI/eval/preliminary.php", func: parseDirected },
      // { path: "WAI/eval/p2.php", func: parseDirected },
    ].forEach(g => {
      var url = Site+g.path;
      iface.get(url, g.func);
    });

  }

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
  function parseDirected (iface, jQuery, getAbs, url, index) {
    // notes on how to extend interface
    var statusButton = $("<button/>").text("conf");
    var statusText = $("<div/>").text("sss");
    iface.logElt.find(".index").before(status);
    if (jQuery("#searchRules").length !== 1) {
      iface.error("expected exaclty one <script id=\"searchRules\"></script>");
      return;
    }
    var configRoot;
    try {
      configRoot = JSON.parse(jQuery("#searchRules").text());
    } catch (e) {
      iface.log("<span class=\"error\">"+e.toString().replace(/</g, "&lt;")+"</span><pre>"+jQuery("#searchRules").text()+"</pre>")
      return;
    }
    parseDirectives({
      find: function () {
        return jQuery.apply(jQuery, [].slice.call(arguments));
      }
    }, configRoot, url, ["all"], index);
    // var sections = jQuery(".search-region");
    // sections.each((idx, section) => {
    //   section = jQuery(section);
    //   var h = section.find("[id]").slice(0, 1);
    //   var fragment = h.attr("id");
    //   var closest = url + "#" + fragment;
    //   var theRest = section.find("*").not(h);
    //   index.set(closest, {
    //     0: [h.text()],
    //     1: theRest.map((i, e) => {
    //       return jQuery(e).text();
    //     }).get()
    //   });
    // });
    function parseDirectives (elts, config, href, flavors, index) {
      if ("flavors" in config)
        flavors = config.flavors;
      if ("region" in config) {
        if (!("select" in config.region))
          return iface.log("expected select in "+JSON.stringify(config.region));
        var sections = elts.find(config.region.select);
        if ("next-anchor" in config.region) {
          sections.each((_, section) => {
            var closest = url + "#" + $(section).
                find(config.region["next-anchor"]).slice(0, 1).attr("id");
            parseDirectives($(section), config.region, closest, flavors, index);
          });
        } else if ("follow" in config.region) {
          sections.each((_, section) => {debugger;
            $(section).find(config.region.follow).each((idx, a) => {
              var href = getAbs($(a).attr("href"));
              iface.get(
                href,
                function (iface, jQuery, getAbs, url, index) {
                  parseDirectives({
                    find: function () {
                      return jQuery.apply(jQuery, [].slice.call(arguments));
                    }
                  }, config.region, url, flavors, index);
                });
            });
          });
        } else {
          return index.fail("expected next-anchor or follow in", JSON.stringify(config.region, null, 2));
        }
        return;
      }
      var indexMe = {};
      var found = config.find.reduce((acc, find) =>  {
        innerElts = elts.find(find.select);
        var addMe = {};
        if ("attribute" in find) {
          addMe[find.quality] = innerElts.attr(find.attribute);
        } else {
          addMe[find.quality] = [innerElts.text()];
        }
        index.set(href, addMe);
        return acc.add(innerElts);
      }, $("create empty selection"));
      found.remove();
      if ("rest" in config) {
        var addMe = {};
        addMe[config.rest.quality] = elts.children().map((i, e) => {
          return jQuery(e).text();
        }).get();
        index.set(href, addMe);
      }
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
    startCrawl: startCrawl
  };
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = exportMe;
  else
    window.Scrounger = exportMe;
})();

