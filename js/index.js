const SETTINGS = {
  views: [
    {
      "id": "total",
      "name": "Total",
      "style": "decimal",
    },
    {
      "id": "delta",
      "name": "Delta",
      "style": "percent",
    },
    {
      "id": "ema",
      "name": "Expotential Moving Average",
      "style": "percent",
    },
  ],
  types: [
    {
      "id": "cases",
      "name": "cases",
      "sentiment": "negative",
      "views": {
        "total": {
          "max": 50000,
          "min": 500,
        },
        "delta": {
          "max": 0.5,
          "min": 0.0,
        },
        "ema": {
          "max": 0.3,
          "min": 0.0,
        },
      },
    },
    {
      "id": "deaths",
      "name": "deaths",
      "sentiment": "negative",
      "views": {
        "total": {
          "max": 4000,
          "min": 30,
        },
        "delta": {
          "max": 0.2,
          "min": 0.01,
        },
        "ema": {
          "max": 0.3,
          "min": 0.0,
        },
      },
    },
    {
      "id": "active",
      "name": "active",
      "sentiment": "negative",
      "views": {
        "total": {
          "max": 50000,
          "min": 500,
        },
        "delta": {
          "max": 0.5,
          "min": 0.0,
        },
        "ema": {
          "max": 0.3,
          "min": 0.0,
        },
      },
    },
  ],
};

function processMainData(dataSet, userPreferences) {
  let result = {
    "rows": {
      "population": false,
      "country": false,
      "state": false,
      "county": false,
    },
    "regions": [],
    "dates": [],
  };

  let {type, view} = getTypeAndView(SETTINGS, userPreferences);

  for (let i in dataSet) {
    let region = dataSet[i];
    result.regions.push({
      "id": region.id,
      "population": 400000,
    });

    for (let idx in region.dates) {
      let day = region.dates[idx];

      if (!result.dates[idx]) {
        result.dates[idx] = {
          "num": idx,
          "values": new Array(dataSet.length).fill(null),
        }
      }

      let value = calculateValue(region.dates, idx, type, view);
      let date = parseDate(day.date);

      let maxColor =
        (type.sentiment == "positive" && value > 0) || (type.sentiment == "negative" && value < 0) ? [0, 255, 0] : [255, 0, 0];
      let colorVector = value > 0 ? 1 : -1;
      result.dates[idx].values[i] = {
        "region": region.id,
        "date": date,
        "value": formatValue(value, userPreferences),
        "normalized": region.normalized,
        "color": interpolateColor([255, 255, 255], maxColor, (value / type.views[view.id].max) * colorVector),
        "isToday": isToday(date),
      };
    }
  }
  return result;
}

function processRegionData(sortedDataSet, userPreferences) {
  let {type, view} = getTypeAndView(SETTINGS, userPreferences);
  let filterElement = document.getElementById("regionFilter");

  let filterText = filterElement.value;

  let typeFilter = userPreferences.filter;

  return sortedDataSet.filter(region => {
    if (region.meta.city && !typeFilter.includes("city")) {
      return false;
    }
    if (region.meta.county && !typeFilter.includes("county")) {
      return false;
    }
    if (region.meta.state && !typeFilter.includes("state")) {
      return false;
    }
    if (region.meta.country && !typeFilter.includes("country")) {
      return false;
    }
    return filterText.length == 0 || region.id.toLowerCase().includes(filterText.toLowerCase());
  }).map(region => {
    let value = calculateValue(region.dates, region.dates.length - 1, type, view);
    return {
      "id": region.id,
      "country": region.meta.country,
      "state": region.meta.state,
      "county": region.meta.county,
      "value": formatValue(value, userPreferences),
    };
  });
}

function processData(sortedDataSet, userPreferences) {
  let result = {
    "legend": {
      "min": null,
    },
    "selectedType": userPreferences.type,
    "selectedView": userPreferences.view,
    "main": null,
    "select": {
      "types": null,
      "views": null,
      "regions": null
    }
  };

  let {type, view} = getTypeAndView(SETTINGS, userPreferences);
  result.legend.min = `Last day below ${type.views["total"].min} ${type.name}.`;

  let selectedDataSet = narrowDataSet(sortedDataSet, userPreferences);
  normalizeDataSet(selectedDataSet, userPreferences);
  result.main = processMainData(selectedDataSet, userPreferences);

  result.select.types = SETTINGS.types;
  result.select.views = SETTINGS.views;
  result.select.regions = processRegionData(sortedDataSet, userPreferences);
  return result;
}


async function main() {
  let dataSet = await fetch("./data/timeseries-byLocation.json").then((response) => response.json());

  let userPreferences = getUserPreferences();

  let sortedDataSet = sortDataSet(dataSet, userPreferences);

  let data = processData(sortedDataSet, userPreferences);

  const v = new Vue({
    el: '#app',
    data: {
      data
    }
  });
  document.getElementById("app").style.display = "grid";

  document.getElementById("regionSelect").addEventListener("change", function () {
    let filterElement = document.getElementById("regionFilter");
    let filter = filterElement.value;

    let selected = filter.length > 0 ? userPreferences.regions : [];

    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].selected) {
        selected.push(this.options[i].value);
      } else if (filter.length > 0) {
        selected = selected.filter(item => item != this.options[i].value);
      }
    }

    userPreferences.regions = selected;
    let selectedDataSet = narrowDataSet(sortedDataSet, userPreferences);
    normalizeDataSet(selectedDataSet, userPreferences);
    v.data.main = processMainData(selectedDataSet, userPreferences);

    let params = getSearchParams();
    params.delete("region");
    for (let id of selected) {
      params.append("region", id);
    }
    setURL(params);
  });

  document.getElementById("typeSelect").addEventListener("change", function () {
    userPreferences.type = this.value;
    sortedDataSet = sortDataSet(dataSet, userPreferences);
    v.data = processData(sortedDataSet, userPreferences);

    let params = getSearchParams();
    params.set("type", userPreferences.type);
    setURL(params);
  });

  document.getElementById("viewSelect").addEventListener("change", function () {
    userPreferences.view = this.value;
    v.data = processData(sortedDataSet, userPreferences);
    let params = getSearchParams();
    params.set("view", userPreferences.view);
    setURL(params);
  });

  document.getElementById("regionFilter").addEventListener("input", function () {
    v.data.select.regions = processRegionData(sortedDataSet, userPreferences);
  });
}

main();

