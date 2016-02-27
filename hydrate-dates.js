function hydrateDates(project) {
  // TODO: _.cloneDeep? Is it even worth it?
  project.date_unfurled = new Date(project.date_unfurled);
  return project;
}

module.exports = hydrateDates;
