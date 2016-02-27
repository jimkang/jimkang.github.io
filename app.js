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
var sources = accessor('sources');
var first = accessor('0');
var second = accessor('1');

function identity(x) {
  return x;
}

function primaryLink(d) {
  return d.links[0];
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

  var sourceListSel = all.select('.source-list');
  var sourceItemsSel = sourceListSel.selectAll('.source-item').data(sources);
  sourceItemsSel.exit().remove();
  var allSourceItemSel = sourceItemsSel.enter().merge(sourceItemsSel);
  allSourceItemSel.append('li').classed('source-item', true)
    .append('a').attr('href', first).text(second);
}

function addFieldsToProjects(projectSel) {
  projectSel.append('div').classed('name', true)
    .append('a');
  
  projectSel.append('div').classed('description', true);

  var sources = projectSel.append('div').classed('sources', true);
  sources.append('span').classed('sources-label', true).text('Code:');
  sources.append('ul').classed('source-list', true);
}

function sortByFieldDesc(field, a, b) {
  return (b[field] < a[field]) ? -1 :  1;
}

(((((function go() {
  projects.forEach(hydrateDates);
  projects.sort(curry(sortByFieldDesc)('date_updated'));
  renderProjects(projects);
})()))));
