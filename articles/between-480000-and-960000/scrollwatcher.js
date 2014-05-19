function createScrollWatcher() {

var scrollWatcher = {
  elementWatchInstances: [],
  elementLastVisibleStates: [],
  viewTop: 0,
  viewBottom: 0
};

scrollWatcher.init = function init() {
  window.onscroll = this.respondToScroll.bind(this);
};

scrollWatcher.watchElements = function watchElements(watchDefinitions) {
  this.elementWatchInstances = watchDefinitions.map(function makeInstance(def) {
    return {
      el: document.querySelector(def.selector),
      isInView: def.isInViewFunction
    };
  });
  
  this.elementLastVisibleStates = watchDefinitions.map(
    function alwaysFalse() { return false; });
};

scrollWatcher.respondToScroll = function respondToScroll() {
  this.viewTop = document.body.scrollTop;
  this.viewBottom = this.viewTop + window.innerHeight;

  this.elementWatchInstances.forEach(this.emitIfConsideredVisible.bind(this));
};

scrollWatcher.emitIfConsideredVisible = function emitIfConsideredVisible(watch) {  
  var index = this.elementWatchInstances.indexOf(watch);
  var checkVisible = watch.isInView;
  if (!checkVisible) {
    checkVisible = centerIsVisible;
  }

  var isVisible = checkVisible(this.viewTop, this.viewBottom, watch.el);
  var wasVisible = this.elementLastVisibleStates[index];

  if (isVisible && !wasVisible) {
    document.dispatchEvent(new CustomEvent('elMovedIntoView', 
      {detail: watch.el}));
  }
  else if (!isVisible && wasVisible) {
    document.dispatchEvent(new CustomEvent('elMovedOutOfView', 
      {detail: watch.el}));
  }

  this.elementLastVisibleStates[index] = isVisible;
};

function centerIsVisible(viewTop, viewBottom, el) {
  var center = el.offsetTop + el.offsetHeight/2;
  return (center > viewTop && center < viewBottom);
}

scrollWatcher.init();

return scrollWatcher;
}
