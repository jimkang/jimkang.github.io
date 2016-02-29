function hydrateDates(project) {
  // TODO: _.cloneDeep? Is it even worth it?
  project.date_unfurled = new Date(project.date_unfurled);
  project.date_updated = new Date(project.date_updated);
  return project;
}

module.exports = hydrateDates;
