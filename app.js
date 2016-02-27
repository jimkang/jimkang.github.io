var d3 = require('d3-selection');
var projects = require('./projects.json');
var accessor = require('accessor');
var hydrateDates = require('./hydrate-dates');
var curry = require('lodash.curry');

var sb = require('standard-bail')({
  log: console.log
});

// var projects;

// function saveProjects(projectJSONText) {
//   projects = JSON.parse(renderProjectText);
//   renderProjects(projects);
// }

var id = accessor();

var name = accessor('name');
var description = accessor('description');
var links = accessor('links');
var sources = accessor('sources');
var metalinks = accessor('metalinks');
var first = accessor('0');
var second = accessor('1');

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
  all.select('.description').text(description);

  var linkSel = all.select('.links').selectAll('.link').data(links);
  linkSel.enter().append('li').classed('link', true)
    .append('a').attr('href', first).text(second);

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
    // sel.append('span').classed(classBase + '-label', true).text(label);
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
}

function addFieldsToProjects(projectSel) {
  projectSel.append('div').classed('name', true)
    .append('a');//.classed('heading', true);
  
  var content = projectSel.append('div')
    .classed('project-content', true)
    .classed('textpane', true);

  content.append('div')
    .classed('description', true)
    .classed('textcontent', true);

  content.append('ul')
    .classed('links', true)
    .classed('textcontent', true);

  var lists = content.append('div')
    .classed('lists', true);

  lists.append('div')
    .classed('metalinks', true)
    .classed('textcontent', true)
    .classed('sublist-section', true);

  lists.append('div')
    .classed('sources', true)
    .classed('textcontent', true)
    .classed('sublist-section', true);
}

function sortByFieldDesc(field, a, b) {
  return (b[field] < a[field]) ? -1 :  1;
}

(((((function go() {
  projects.forEach(hydrateDates);
  projects.sort(curry(sortByFieldDesc)('date_updated'));
  renderProjects(projects);
})()))));
