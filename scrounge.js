#!/usr/bin/env node

var jsdom = require("jsdom");

// var jqURL = "http://localhost/2017/04/wai-search/jquery/jquery-1.12.4.js"
var jqURL = "http://code.jquery.com/jquery.js";

var resourceText = {
};

var todo = 0;
function add (url) {
  ++todo;
}
function finished (url) {
  if (--todo === 0)
    console.log(JSON.stringify(resourceText));
}

var perspectivesIndexURL = "https://www.w3.org/WAI/perspectives/";
add(perspectivesIndexURL);
jsdom.env(
  perspectivesIndexURL,
  [jqURL],
  function (err, indexWindow) {
    var videoPages = indexWindow.$(".video-listing li");
    var a = indexWindow.document.createElement('a');
    function getAbs (rel) {
      a.href = rel;
      return a.href;
    }
    console.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var perspectiveName = indexWindow.$(li).find("a").attr("href");
      var perspectivePageUrl = getAbs(perspectiveName);
      add(perspectivePageUrl);

      jsdom.env(
        perspectivePageUrl,
        [jqURL],
        function (err, pageWindow) {
          var desc = pageWindow.$("meta[name=description]").attr("content").
              replace(/^Short? +video +about +/, "").
              replace(/ - what (is it|are they).*/, "").
              replace(/ for web accessibility$/, "");
          resourceText[perspectivePageUrl] = desc;
          finished(perspectivePageUrl);
        }
      );
    });
    finished(perspectivesIndexURL);
  }
);

var tutorialsIndexURL = "https://www.w3.org/WAI/tutorials/";
add(tutorialsIndexURL);
jsdom.env(
  tutorialsIndexURL,
  [jqURL],
  function (err, indexWindow) {
    var videoPages = indexWindow.$("ul.topics li");
    var a = indexWindow.document.createElement('a');
    function getAbs (rel) {
      a.href = rel;
      return a.href;
    }
    console.log("scraping", videoPages.length, "video pages:");
    videoPages.each((idx, li) => {
      var relativeName = indexWindow.$(li).find("a").attr("href");
      var pageURL = getAbs(relativeName);
      console.log(pageURL);
      add(pageURL);

      jsdom.env(
        pageURL,
        [jqURL],
        function (err, pageWindow) {
          var subPages = pageWindow.$("ul[aria-labelledby=list-heading-tutorials] li");
          console.log(subPages.length, "sub-pages"); // , subPages.find("a").attr("href").get().join(",")
          var a = pageWindow.document.createElement('a');
          function getAbs (rel) {
            a.href = rel;
            return a.href;
          }
    subPages.each((idx, li) => {
      var tutorialName = indexWindow.$(li).find("a").attr("href");
      var tutorialPageUrl = getAbs(tutorialName);
      add(tutorialPageUrl);

      jsdom.env(
        tutorialPageUrl,
        [jqURL],
        function (err, pageWindow) {
          var headings = pageWindow.$("h2");
          // console.log(tutorialPageUrl, headings.length);
          var desc = headings.map((idx, h) => { return pageWindow.$(h).text(); }).get().join(" ");
          resourceText[tutorialPageUrl] = desc;
          finished(tutorialPageUrl);
        }
      );
    });
          finished(pageURL);
        }
      );
    });
    finished(tutorialsIndexURL);
  }
);

