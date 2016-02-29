var d3 = require('d3-selection');
var projects = require('./projects.json');
var accessor = require('accessor');
var hydrateDates = require('./hydrate-dates');
var curry = require('lodash.curry');
var addFieldsToProjects = require('./render/add-fields-to-projects');

var sb = require('standard-bail')({
  log: console.log
});

var id = accessor();

var name = accessor('name');
var description = accessor('description');
var techinfo = accessor('techinfo');
var links = accessor('links');
var sources = accessor('sources');
var metalinks = accessor('metalinks');
var dateUpdated = accessor('date_updated');
var dateUnfurled = accessor('date_unfurled');
var first = accessor('0');
var second = accessor('1');

function formatDateAccessor(theAccessor, d) {
  return theAccessor(d).toLocaleDateString();
}

function identity(x) {
  return x;
}

function primaryLink(d) {
  return d.links[0][0];
}

function renderProjects(projectsData) {
  var root = d3.select('#projects');
  var update = root.selectAll('.project').data(projectsData, id).attr('id', id);

  update.exit().remove();

  var entered = update.enter().append('li').classed('project', true);
  addFieldsToProjects(entered);

  var all = entered.merge(update);
  all.select('.name a').text(name).attr('href', primaryLink);
  all.select('.description').html(description);

  all.select('.techinfo').each(updateTechInfo);

  var linkSel = all.select('.links').selectAll('.link').data(links);
  linkSel.enter().append('div').classed('link', true)
    .append('a').attr('href', first).text(second);

  all.selectAll('.dates .last-updated-field').text(
    curry(formatDateAccessor)(dateUpdated)
  );
  all.selectAll('.dates .unfurled-field').text(
    curry(formatDateAccessor)(dateUnfurled)
  );

  all.selectAll('.sources').each(
    curry(updateArrayTree)(sources, 'sublist-section', 'Code:', false)
  );
  all.selectAll('.metalinks').each(
    curry(updateArrayTree)(metalinks, 'sublist-section', 'Reviews:', false)
  );
}

function updateArrayTree(rootAccessor, classBase, label, alwaysMakeList, d) {
  var sel = d3.select(this);
  sel.selectAll('*').remove();
  var arrayData = rootAccessor(d);

  if (arrayData.length > 1 || (arrayData.length > 0 && alwaysMakeList)) {
    var listSel = sel.append('ul').classed(classBase + '-list', true);
    var itemsSel = listSel.selectAll(classBase + '.-item').data(rootAccessor);
    itemsSel.exit().remove();
    var allItemsSel = itemsSel.enter().merge(itemsSel);
    allItemsSel.append('li').classed(classBase + '-item', true)
      .append('a').attr('href', first).text(second);
  }
  else if (arrayData.length > 0) {
    sel.append('a').attr('href', arrayData[0][0]).text(arrayData[0][1]);
  }

  if (arrayData.length > 0) {
    sel.classed('squash', false);
  }
}

function updateTechInfo(d) {
  var sel = d3.select(this);
  sel.selectAll('*').remove();

  if (d.techinfo) {
    sel.classed('squash', false);    
    sel.append('a').text('➔ Technical information').on('click', revealTechinfo);
  }
}

function revealTechinfo(d) {
  var techinfoSel = d3.select(this.parentElement);
  techinfoSel.selectAll('*').remove();
  techinfoSel.html(d.techinfo);
}

function sortByFieldDesc(field, a, b) {
  return (b[field] < a[field]) ? -1 :  1;
}

(((((function go() {
  projects.forEach(hydrateDates);
  projects.sort(curry(sortByFieldDesc)('date_updated'));
  renderProjects(projects);
})()))));
