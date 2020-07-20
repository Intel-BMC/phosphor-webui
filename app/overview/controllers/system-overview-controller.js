/**
 * Controller for systemOverview
 *
 * @module app/overview
 * @exports systemOverviewController
 * @name systemOverviewController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.overview').controller('systemOverviewController', [
    '$scope', '$window', '$filter', '$location', '$timeout', 'APIUtils',
    'toastService', 'dataService', 'Constants', '$q',
    function(
        $scope, $window, $filter, $location, $timeout, APIUtils, toastService,
        dataService, Constants, $q) {
      $scope.dataService = dataService;
      $scope.dropdown_selected = false;
      $scope.logs = [];
      $scope.server_info = {};
      $scope.bmc_firmware = '';
      $scope.bmc_time = '';
      $scope.server_firmware = '';
      $scope.network_info = [];
      $scope.loading = false;
      $scope.edit_hostname = false;
      $scope.newHostname = '';
      $scope.curTime = '';
      $scope.bmc_info = {};

      loadOverviewData();

      $scope.RedirectToURL = function(destinationURL) {
        $location.url(destinationURL);
      };

      $scope.sendParamsToEventPage = function(severity, fulldate) {
        $location.path('/server-health/sys-log')
            .search('severity', severity.toLowerCase())
            .search('startdate', fulldate + 'T00:00:00.000')
            .search('enddate', fulldate + 'T00:00:00.000');
      };

      function loadOverviewData() {
        $scope.loading = true;

        var getFirmwaresPromise = APIUtils.getBMCInformation().then(
            function(res) {
              $scope.bmc_info = res;
            },
            function(error) {
              console.log(JSON.stringify(error));
            });

        var getLEDStatePromise = APIUtils.getLEDState().then(
            function(data) {
              if (data == APIUtils.LED_STATE_TEXT.on) {
                dataService.LED_state = APIUtils.LED_STATE.on;
              } else {
                dataService.LED_state = APIUtils.LED_STATE.off;
              }
            },
            function(error) {
              console.log(JSON.stringify(error));
            });

        var getServerInfoPromise = APIUtils.getServerInfo().then(
            function(data) {
              $scope.server_info = data;
            },
            function(error) {
              console.log(JSON.stringify(error));
            });

        var getNetworkInfoPromise = APIUtils.getNetworkInfo().then(
            function(data) {
              // TODO: openbmc/openbmc#3150 Support IPV6 when
              // officially supported by the backend
              $scope.network_info = data;
              $scope.newHostname = data.HostName;
            },
            function(error) {
              console.log(JSON.stringify(error));
            });

        var getBMCTimePromise = APIUtils.getBMCTime().then(
            function(data) {
              $scope.curTime = new Date(data.DateTime);
              $scope.curTime2 = $filter('date')($scope.curTime, 'mediumTime');
              $scope.curTime = $filter('date')($scope.curTime, 'mediumDate');
            },
            function(error) {
              console.log(JSON.stringify(error));
            });

        var promises = [
          getFirmwaresPromise,
          getLEDStatePromise,
          getBMCTimePromise,
          getServerInfoPromise,
          getNetworkInfoPromise,
        ];

        $q.all(promises).finally(function() {
          $scope.loading = false;
        });
      }

      $scope.toggleLED = function() {
        var toggleState = (dataService.LED_state == APIUtils.LED_STATE.on) ?
            APIUtils.LED_STATE.off :
            APIUtils.LED_STATE.on;
        dataService.LED_state =
            (dataService.LED_state == APIUtils.LED_STATE.on) ?
            APIUtils.LED_STATE.off :
            APIUtils.LED_STATE.on;
        APIUtils.setLEDState(toggleState, function(status) {});
      };

      /************* GET EVENT LOGS **************/
      $scope.iterateBackwards = false;
      $scope.loadInitial = false;
      $scope.eventLoading = true;
      $scope.eventOverviewLoading = true;
      $scope.sysLogs = [];
      $scope.outputCount = 1000;
      $scope.logDetailQuantity = 25;

      APIUtils.getSystemLogCount().then(
          function(totallogCount) {
            var firstRecord =
                totallogCount - Constants.PAGINATION.LOG_ITEMS_PER_PAGE;
            if (!$scope.loadInitial) {
              if (!$scope.iterateBackwards) {
                firstRecord = 0;
              } else {
                firstRecord = totallogCount - $scope.outputCount;
              };
            };
            $scope.displaySystemLogs(
                $scope.loadInitial, $scope.outputCount, firstRecord,
                totallogCount);
          },
          function(error) {
            console.log(JSON.stringify(error));
          })


      // Iterates through all system logs.
      // TODO: Consider if this is too time consuming, could just do 1000
      $scope.displaySystemLogs = function(
          loadInitial, outputCount, firstRecord, logCount) {
        if (loadInitial) {
          // for fast loading of initial set (overwrite outputCount)
          var outputAmount = Constants.PAGINATION.LOG_ITEMS_PER_PAGE;
        } else {
          var outputAmount = outputCount;
        };

        APIUtils.getSystemLogs(outputAmount, firstRecord)
            .then(
                function(res) {
                  $scope.sysLogs = [].concat($scope.sysLogs, res);
                  $scope.eventLoading = false;
                },
                function(error) {
                  console.log(JSON.stringify(error));
                })
            .finally(
                function() {
                  var iterate = false;
                  if (loadInitial) {
                    $scope.loading = false;
                    loadInitial = false;
                    if (!$scope.iterateBackwards) {
                      firstRecord = -outputCount;
                      logCount = logCount - outputAmount;
                    };
                  };
                  if ($scope.iterateBackwards) {
                    if (firstRecord > 0) {
                      iterate = true;
                      if (firstRecord > outputCount) {
                        firstRecord = firstRecord - outputCount;
                      } else {
                        // return remaining if less than outputCount
                        outputCount = firstRecord;
                        firstRecord = 0;
                      };
                    };
                  } else {
                    firstRecord = firstRecord + outputCount;
                    if (firstRecord < logCount) {
                      iterate = true;
                      if ((firstRecord + outputCount) > logCount) {
                        outputCount = logCount - firstRecord;
                      };
                    };
                  };
                  if (iterate) {
                    return $scope.displaySystemLogs(
                        loadInitial, outputCount, firstRecord, logCount);
                  } else {
                    $scope.summarizeEventCount();
                  };
                },
                function(error) {
                  console.log(JSON.stringify(error));
                });
      };

      $scope.parseMessageID = function(str) {
        str = str.slice((str.lastIndexOf('.') + 1), str.length);
        str = str.replace(/([a-z])([A-Z])/g, '$1 $2');
        return str;
      };

      $scope.useEndofStringOnly = function(str) {
        return str.slice(
            (log.MessageId.lastIndexOf('.') + 1), log.MessageId.length)
      };

      /******** BAR CHART ********************* */

      $scope.eventCount = [];
      $scope.highestEventCount = 0;
      $scope.daysToShow =
          7;  // sets default bar chart days; overwritten if not enough data

      $scope.addEventArray = function(
          d1, d1Formatted, countOK, countWarning, countCritical) {
        var update = false;
        var obj = [
          {dayName: d1, fullDate: d1Formatted, count: countOK, severity: 'OK'},
          {
            dayName: d1,
            fullDate: d1Formatted,
            count: countWarning,
            severity: 'Warning'
          },
          {
            dayName: d1,
            fullDate: d1Formatted,
            count: countCritical,
            severity: 'Critical'
          }
        ];

        for (var i = 0; i < $scope.eventCount.length; i++) {
          if ($scope.eventCount[i][0].dayName === d1) {
            $scope.eventCount[i][0].count = countOK;
            $scope.eventCount[i][1].count = countWarning;
            $scope.eventCount[i][2].count = countCritical;

            update = true;
            if ((countOK + countWarning + countCritical) >
                $scope.highestEventCount) {
              $scope.highestEventCount = countOK + countWarning + countCritical;
            }
          }
        }
        if (update == false) {
          $scope.eventCount.push(obj);
        }
      };

      $scope.summarizeEventCount = function() {
        var countOK = 0;
        var countWarning = 0;
        var countCritical = 0;
        var d1 = '';
        var d1Formatted = '';

        angular.forEach($scope.sysLogs, function(log, index) {
          if (log.Created.length > 0) {
            if (index == 0) {
              d1 = new Date(log.Created);
              d1Formatted = $filter('date')(d1, 'yyyy-MM-dd');
              d1 = $filter('date')(d1, 'MMM d');

              var presentDate = new Date();
              $scope.firstDate = new Date(log.Created);

              var adjustDays =
                  (presentDate.getTime() - $scope.firstDate.getTime()) /
                  (24 * 60 * 60 * 1000);
              if (adjustDays < $scope.daysToShow) {
                $scope.daysToShow = adjustDays;
                $scope.daysToShow = Math.ceil($scope.daysToShow)
              };

              for (var i = (-$scope.daysToShow + 1); i < 1; i++) {
                var barChartStartDate =
                    new Date(new Date().getTime() + (i * 24 * 60 * 60 * 1000));

                d1Formatted = $filter('date')(barChartStartDate, 'yyyy-MM-dd');
                if (i == (-$scope.daysToShow + 1)) {
                  $scope.firstDate =
                      $filter('date')(barChartStartDate, 'MMM d');

                  d1 = $filter('date')($scope.firstDate, 'MMM d');
                };
                barChartStartDate = $filter('date')(barChartStartDate, 'MMM d');
                $scope.addEventArray(barChartStartDate, d1Formatted, 0, 0, 0);
              }
            }

            var d2 = new Date(log.Created);
            d2 = $filter('date')(d2, 'MMM d');

            if (Date.parse(d2) >= Date.parse($scope.firstDate)) {
              if (Date.parse(d2) != Date.parse(d1)) {
                $scope.addEventArray(
                    d1, d1Formatted, countOK, countWarning, countCritical)
                countOK = 0;
                countWarning = 0;
                countCritical = 0;
                d1 = new Date(log.Created);
                d1Formatted = $filter('date')(d1, 'yyyy-MM-dd');
                d1 = $filter('date')(d1, 'MMM d');
              }
              if (log.Severity == 'OK') {
                countOK = countOK + 1;
              }
              if (log.Severity == 'Warning') {
                countWarning = countWarning + 1;
              }
              if (log.Severity == 'Critical') {
                countCritical = countCritical + 1;
              }
            };
          };
        });
        $scope.addEventArray(
            d1, d1Formatted, countOK, countWarning, countCritical)
        $scope.eventOverviewLoading = false;
      };

      /************* SENSORS************* */
      /*TODO: go through and keep only what's necessary*/
      $scope.dataService = dataService;
      $scope.dropdown_selected = false;

      $scope.componentList = [];
      $scope.sensorsInfo = {};
      $scope.fullSensorsInfo = [];
      $scope.selectedComponent = {};
      $scope.showThresholds = true;
      $scope.customSearch = '';
      $scope.searchTerms = [];
      $scope.messages = Constants.MESSAGES.SENSOR;

      $scope.selectedSeverity = 'all';
      $scope.severityList = ['All', 'Critical', 'Warning', 'Ok'];

      $scope.sensorsInfo.Temperatures = [];
      $scope.sensorsInfo.Fans = [];
      $scope.sensorsInfo.Voltages = [];
      $scope.sensorsInfo.Merged = [];
      $scope.selectedChoice = 'All';
      $scope.resultsShown = false;
      $scope.filterSeverity = '';

      $scope.keyname = 'Created';
      $scope.reverseSeverity = true;
      $scope.reverse = true;
      $scope.showSensor = false;
      $scope.sensorBars = [1, 2, 3, 4, 5];


      // SENSOR BARS & PIE CHART
      $scope.sensorsOutofRange = false;
      $scope.sensorHeading = 'Sensors';
      $scope.countOK = 0;
      $scope.countWarning = 0;
      $scope.countCritical = 0;
      $scope.totalSensors = 0;
      $scope.sensorLoading = true;
      $scope.sensorBar = [];
      var curColorValue = 5;
      var record = 0;

      // FIRST//
      $scope.loadSensorData = function() {
        var deferred = $q.defer();
        var i = 0;
        var chassisListTotal = 2;
        $scope.sensorPromises = [];
        var items = ['', ''];
        APIUtils.getAllChassisCollection().then(
            function(chassisList) {
              chassisListTotal = chassisList.length;
              angular.forEach(chassisList, function(chassis) {
                i = i + 1
                var resData = getComponentSensors(chassis, chassisListTotal, i);
                $scope.fullSensorsInfo.push(resData);
                //  $scope.sensorPromises[i] = true;
                items.push(resData[i]);
              });
            },
            function(error) {
              console.log(JSON.stringify(error));
            });
        deferred.resolve(items);
        return deferred.promise;
      };

      // SECOND//
      function getComponentSensors(component, totalChassis, curChassis) {
        var data = component;
        data['sensors'] = {'Temperatures': [], 'Fans': [], 'Voltages': []};

        APIUtils.getSensorsInfo(component.Power['@odata.id'])
            .then(function(res) {
              if (res.hasOwnProperty('Voltages')) {
                data.sensors['Voltages'] = res.Voltages;
              }
              APIUtils.getSensorsInfo(component.Thermal['@odata.id'])
                  .then(function(res) {
                    if (res.hasOwnProperty('Temperatures')) {
                      data.sensors['Temperatures'] = res.Temperatures;
                    }
                    if (res.hasOwnProperty('Fans')) {
                      data.sensors['Fans'] = res.Fans;
                    }
                    return;
                  })
                  .finally(function() {
                    if (curChassis == totalChassis) {
                      $scope.loadMergedSensors().then(function(result) {
                        $scope.summarizeSensors().then(function(result) {
                          $scope.sensorLoading = false;
                        });
                      });
                    };
                  });
              return;
            })

        return data;
      };

      // THIRD//
      $scope.loadMergedSensors = function() {
        var deferred = $q.defer();
        // Flattened sensor data to display all sensors
        // Looping through all chassis collections to flatten sensors data
        angular.forEach($scope.fullSensorsInfo, function(record) {
          $scope.sensorsInfo.Temperatures = [].concat(
              $scope.sensorsInfo.Temperatures, record.sensors.Temperatures);
          $scope.sensorsInfo.Fans =
              [].concat($scope.sensorsInfo.Fans, record.sensors.Fans);
          $scope.sensorsInfo.Voltages =
              [].concat($scope.sensorsInfo.Voltages, record.sensors.Voltages);
        });

        // FOURTH: merge all sensors into one array
        $scope.mergedSensors = $scope.sensorsInfo.Voltages.concat(
            $scope.sensorsInfo.Fans, $scope.sensorsInfo.Temperatures);
        deferred.resolve($scope.mergedSensors);
        return deferred.promise;
      };

      // FIFTH - FINALLY //
      $scope.summarizeSensors = function() {
        var deferred = $q.defer();

        angular.forEach($scope.mergedSensors, function(sensor, $index) {
          if (sensor.Reading) {
            var curReading = sensor.Reading;
          };
          if (sensor.ReadingCelsius) {
            var curReading = sensor.ReadingCelsius;
          };
          if (sensor.ReadingVolts) {
            var curReading = sensor.ReadingVolts;
          };
          if (curReading) {
            curReading = ($filter('number')(curReading, 2))
          };

          var showReadingUnits = $scope.getReadingUnits(
              sensor.ReadingVolts, sensor.ReadingCelsius, sensor.ReadingUnits);

          // defaults in case value is empty
          var iMaxReading = 1000;
          var iMinReading = 0;
          var iLowerThresholdCritical = 0;
          var iUpperThresholdNonCritical = 0;
          var iLowerThresholdNonCritical = 0;
          var iUpperThresholdCritical = 0;
          var showReading = [];
          var showColor = [];

          if (sensor.MaxReadingRangeTemp) {
            var iMaxReading = sensor.MaxReadingRangeTemp;
          };
          if (sensor.MaxReadingRange) {
            var iMaxReading = sensor.MaxReadingRange;
          };
          if (sensor.MinReadingRangeTemp) {
            iMinReading = sensor.MinReadingRangeTemp;
          };
          if (sensor.MinReadingRange) {
            iMinReading = sensor.MinReadingRange;
          };

          if (sensor.LowerThresholdCritical) {
            iLowerThresholdCritical = sensor.LowerThresholdCritical;
            var sLowerThresholdCritical = 'Critical ' +
                ($filter('number')(sensor.LowerThresholdCritical, 2)) + '\xa0' +
                showReadingUnits;
          };
          if (sensor.UpperThresholdNonCritical) {
            iUpperThresholdNonCritical = sensor.UpperThresholdNonCritical;
            var sUpperThresholdNonCritical = 'Warning ' +
                ($filter('number')(sensor.UpperThresholdNonCritical, 2)) +
                '\xa0' + showReadingUnits;
          };
          if (sensor.LowerThresholdNonCritical) {
            iLowerThresholdNonCritical = sensor.LowerThresholdNonCritical;
            var sLowerThresholdNonCritical = 'Warning ' +
                ($filter('number')(sensor.LowerThresholdNonCritical, 2)) +
                '\xa0' + showReadingUnits;
          };
          if (sensor.UpperThresholdCritical) {
            iUpperThresholdCritical = sensor.UpperThresholdCritical;
            var sUpperThresholdCritical = 'Critical ' +
                ($filter('number')(sensor.UpperThresholdCritical, 2)) + '\xa0' +
                showReadingUnits;
          };

          var obj = [
            iMinReading, iLowerThresholdCritical, iLowerThresholdNonCritical,
            iUpperThresholdNonCritical, iUpperThresholdCritical, iMaxReading
          ];

          if (curReading &&
              (sensor.Status.Health == 'Warning' ||
               sensor.Status.Health == 'Critical')) {
            for (var i = 0; i < 5; i++) {
              if ((curReading > iMaxReading && i == 4) ||
                  (curReading >= obj[i] && curReading < obj[i + 1])) {
                curColorValue = 5;
                showReading[i] = curReading + '\xa0' + showReadingUnits;
                showColor[i] = curColorValue;
                if (curColorValue) {
                  // loop number of times equal to i to reset previous blocks
                  for (var j = (i - 1); j > -1; j--) {
                    curColorValue = curColorValue - 1;
                    showColor[j] = curColorValue;
                  };
                };
                curColorValue = 5;
              } else {
                curColorValue = curColorValue - 1;
                showColor[i] = curColorValue;
                showReading[i] = '';
              };
            };
          } else {
            showColor[0] = 3;
            showColor[1] = 4;
            showColor[2] = 5;
            showColor[3] = 4;
            showColor[4] = 3;
            showReading[2] = curReading + '\xa0' + showReadingUnits;
          };

          var obj2 = [
            {
              thresholdText: sLowerThresholdCritical,
              showName: '',
              statusHealth: sensor.Status.Health,
              curReading: showReading[0],
              colorValue: showColor[0]
            },
            {
              thresholdText: sLowerThresholdNonCritical,
              showName: '',
              statusHealth: sensor.Status.Health,
              curReading: showReading[1],
              colorValue: showColor[1]
            },
            {
              thresholdText: '',
              showName: sensor.Name,
              statusHealth: sensor.Status.Health,
              curReading: showReading[2],
              colorValue: showColor[2]
            },
            {
              thresholdText: sUpperThresholdNonCritical,
              showName: '',
              statusHealth: sensor.Status.Health,
              curReading: showReading[3],
              colorValue: showColor[3]
            },
            {
              thresholdText: sUpperThresholdCritical,
              showName: '',
              statusHealth: sensor.Status.Health,
              curReading: showReading[4],
              colorValue: showColor[4]
            }
          ];
          $scope.sensorBar.push(obj2);
          record = record + 1;
          curReading = '';    // reset
          curColorValue = 5;  // reset

          if (sensor.Status.Health == 'OK') {
            $scope.countOK = $scope.countOK + 1;
          }
          if (sensor.Status.Health == 'Warning') {
            $scope.countWarning = $scope.countWarning + 1;
          }
          if (sensor.Status.Health == 'Critical') {
            $scope.countCritical = $scope.countCritical + 1;
          }
          $scope.totalSensors = $index + 1;
        });

        if ($scope.countWarning > 0 || $scope.countCritical > 0) {
          $scope.sensorsOutofRange = true;
          $scope.sensorHeading = 'Out of Range';
        } else {
          $scope.filterSeverity = 'all';
          $scope.sensorHeading = 'Sensors Detail';
        };

        deferred.resolve();
        return deferred.promise;
      };

      $scope.filterBySeverity = function(sensors) {
        if ($scope.filterSeverity == 'all') {
          return true
        };
        return (
            (sensors[1].statusHealth === 'OK' && false) ||
            (sensors[1].statusHealth === 'Warning' && $scope.countWarning) ||
            (sensors[1].statusHealth === 'Critical' && $scope.countCritical));
      };

      $scope.getReadingUnits = function(
          readingVolts, readingCelsius, readingUnits) {
        var sStr = '';

        if (readingVolts) {
          sStr = sStr + 'V';
        };

        if (readingCelsius) {
          sStr = sStr + '\xB0' +
              ' C';
        };
        if (readingUnits) {
          sStr = readingUnits.replace('Percent', '%');
        }

        return sStr;
      };

      // Repeat from navigation
      $scope.RedirectToURL = function(destinationURL) {
        $location.url(destinationURL);
      };

      $scope.jsonData = function(data) {
        var dt = {};
        data.data.forEach(function(item) {
          dt[item.original_data.key] = item.original_data.value;
        });
        return JSON.stringify(dt);
      };

      $scope.orderDatabySeverity = function(val) {
        return ['Critical', 'Warning', 'OK'].indexOf(val[1].statusHealth);
      };

      $scope.loadSensorData();

      $scope.setBarChart = function(eventNum) {
        if (eventNum) {
          return {'height': (eventNum * 150 / $scope.highestEventCount) + 'px'};
        } else {
          return {'display': 'none'};
        }
      };

      $scope.setPieChart = function(portion, aspect) {
        if ($scope.totalSensors) {
          var countOK = $scope.countOK;
          var countWarning = $scope.countWarning;
          var countCritical = $scope.countCritical;

          if (countOK > ($scope.totalSensors / 2)) {
            countOK = countOK - $scope.totalSensors / 2;

            $scope.color =
                '#8ad0eb';  // TODO: make this a class and call the class
          };

          if (countWarning > ($scope.totalSensors / 2)) {
            countWarning = countWarning - $scope.totalSensors / 2;
            $scope.color =
                '#45a5f5';  // TODO: make this a class and call the class
          };

          if (countCritical > ($scope.totalSensors / 2)) {
            countCritical = countCritical - $scope.totalSensors / 2;
            $scope.color =
                '#93d5ed';  // TODO: make this a class and call the class
          };

          $scope.extra = .5

          // TODO: need to check which of the above variables is
          // over 50% and then take 100%-x to make this variable
          // Also need to determine which color it is and set

          var proportion = [
            0, (countOK / $scope.totalSensors),
            (countWarning / $scope.totalSensors),
            (countCritical / $scope.totalSensors), $scope.extra
          ];

          if (portion == 1 && aspect) {
            return {'transform': 'rotate(' + (proportion[1] * 360) + 'deg)'};
          } else if (portion == 2 && !aspect) {
            return {'transform': 'rotate(' + (proportion[1] * 360) + 'deg)'};
          } else if (portion == 2 && aspect) {
            return {'transform': 'rotate(' + (proportion[2] * 360) + 'deg)'};
          } else if (portion == 3 && !aspect) {
            return {
              'transform':
                  'rotate(' + ((proportion[1] + proportion[2]) * 360) + 'deg)'
            };
          } else if (portion == 3 && aspect) {
            return {'transform': 'rotate(' + (proportion[3] * 360) + 'deg)'};
          } else if (portion == 4 && !aspect) {
            return {'transform': 'rotate(' + ((-proportion[4] * 360)) + 'deg)'};
          } else if (portion == 4 && aspect) {
            return {
              'transform': 'rotate(' + ((proportion[4] * 360)) + 'deg)',
              'background-color': '#00aeef'
            };
          };
        };
      };
    }
  ]);
})(angular);
