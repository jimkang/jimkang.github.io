function addFieldsToProjects(projectSel) {
  projectSel.append('div').classed('name', true)
    .append('a');//.classed('heading', true);
  
  var content = projectSel.append('div')
    .classed('project-content', true)
    .classed('textpane', true);

  content.append('div')
    .classed('description', true)
    .classed('textcontent', true);

  content.append('div')
    .classed('techinfo', true)
    .classed('textcontent', true)
    .classed('squash', true);

  content.append('ul')
    .classed('links', true)
    .classed('textcontent', true);

  var lists = content.append('div')
    .classed('lists', true);

  lists.append('div')
    .classed('metalinks', true)
    .classed('textcontent', true)
    .classed('sublist-section', true)
    .classed('squash', true);

  lists.append('div')
    .classed('sources', true)
    .classed('textcontent', true)
    .classed('sublist-section', true)
    .classed('squash', true);

  var dateSel = projectSel.append('div')
    .classed('dates', true)
    // .classed('textcontent', true)
    // .classed('sublist-section', true);

  var lastUpdatedSel = dateSel.append('span').classed('updated-container', true);
  lastUpdatedSel.append('span').text('Updated:');
  lastUpdatedSel.append('span').classed('last-updated-field', true);

  var unfurledSel = dateSel.append('span').classed('unfurled-container', true);
  unfurledSel.append('span').text('Unfurled:');
  unfurledSel.append('span').classed('unfurled-field', true);    
}

module.exports = addFieldsToProjects;
