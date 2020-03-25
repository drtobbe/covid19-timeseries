function intoDatesArray(dates) {
  let result = [];
  for (let date in dates) {
    result.push({
      date,
      value: dates[date]
    });
  }
  return result;
}

function sortDataSet(dataSet, userPreferences) {
  let {type} = getTypeAndView(SETTINGS, userPreferences);
  let result = [];

  for (let regionCode in dataSet) {
    let region = dataSet[regionCode];

    let keys = Object.keys(region.dates);
    let lastDate = region.dates[keys[keys.length - 1]];
    if (lastDate.cases < 20) {
      continue
    }

    result.push({
      "id": regionCode,
      "dates": intoDatesArray(region.dates),
      "meta": {
        "country": region.country,
        "state": region.state,
        "county": region.county,
        "city": region.city,
        "rating": region.rating,
        "tz": region.tz,
        "population": region.population,
      },
    });
  }

  return result.sort((a, b) => {
    let valueA = calculateValue(a.dates, a.dates.length - 1, type, getView(SETTINGS, "total"));
    let valueB = calculateValue(b.dates, b.dates.length - 1, type, getView(SETTINGS, "total"));
    return valueB - valueA;
  });
}
