const { LABELS } = require('./normalize');

function findMetricLabel(label) {
  const wanted = Object.entries(LABELS).find(([, aliases]) => aliases.some((alias) => label.toLowerCase().includes(alias)));
  return wanted ? wanted[0] : null;
}

module.exports = { findMetricLabel };
