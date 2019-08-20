import {_} from 'core-js';

/**
 * Controller for sensors-overview
 *
 * @module app/serverHealth
 * @exports sensorsOverviewController
 * @name sensorsOverviewController
 */

window.angular && (function(angular) {
  'use strict';
  angular.module('app.overview').controller('sensorsOverviewController', [
    '$scope', '$q', '$window', '$filter', '$timeout', 'APIUtils',
    'toastService', 'dataService', 'Constants',
    function(
        $scope, $q, $window, $filter, $timeout, APIUtils, toastService,
        dataService, Constants) {
      $scope.dataService = dataService;
      $scope.dropdown_selected = false;

      $scope.loading = false;
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

      $scope.filteredVoltSensors = [];
      $scope.filteredTempSensors = [];
      $scope.filteredFanSensors = [];
      $scope.filteredSevereSensors = [];
      $scope.severeNodesCount = 0;
      $scope.warningNodesCount = 0;
      $scope.suppressAlerts = false;
      $scope.alertloadMessage = '';
      $scope.sensorsInfo.Temperatures = [];
      $scope.sensorsInfo.Fans = [];
      $scope.sensorsInfo.Voltages = [];
      $scope.sensorsInfo.Merged = [];
      $scope.selectedChoice = 'All';
      $scope.resultsShown = false;
      $scope.reverseSeverity = false;
      $scope.reverse = true;
      $scope.keyname = 'Name';
      $scope.myEl = angular.element(document.querySelector('#sensor-message'));
      $scope.myEl.addClass('sensor-hide');
      $scope.export_name = 'sensors.json';
      $scope.loading = false;

      $scope.jsonData = function(data) {
        var dt = {};
        data.data.forEach(function(item) {
          dt[item.original_data.key] = item.original_data.value;
        });
        return JSON.stringify(dt);
      };

      $scope.doSearchOnEnter = function(event) {
        var search =
            $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
        if (event.keyCode === 13 && search.length >= 1) {
          $scope.searchTerms = $scope.customSearch.split(' ');
        } else if (search.length == 1) {
          $scope.searchTerms = search;
        } else {
          if (search.length == 0) {
            $scope.searchTerms = [];
          }
        }
      };

      $scope.doSearchOnClick = function() {
        var search =
            $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
        if (search.length >= 2) {
          $scope.searchTerms = $scope.customSearch.split(' ');
        } else if (search.length == 1) {
          $scope.searchTerms = search;
        } else {
          if (search.length == 0) {
            $scope.searchTerms = [];
          }
        }
      };


      $scope.toggleSeverity = function(severity) {
        severity = $filter('lowercase')(severity)
        $scope.selectedSeverity = severity;
      };


      $scope.filterBySeverity = function(sensor) {
        if ($scope.selectedSeverity == 'all') return true;
        return (
            ((sensor.Status.Health == 'OK') &&
             ($scope.selectedSeverity == 'ok')) ||
            ((sensor.Status.Health == 'Warning') &&
             $scope.selectedSeverity == 'warning') ||
            ((sensor.Status.Health == 'Critical') &&
             $scope.selectedSeverity == 'critical'));
      };

      $scope.filterBySearchTerms = function(sensor) {
        if (!$scope.searchTerms.length) return true;
      };

      $scope.loadMergedSensors = function() {
        $scope.loading = true;
        // Flattened sensor data to display all sensors.
        $scope.sensorsInfo = {'Temperatures': [], 'Fans': [], 'Voltages': []};
        // Looping through all chassis collections to flattened sensors data
        angular.forEach($scope.fullSensorsInfo, function(record) {
          $scope.sensorsInfo.Temperatures = [].concat(
              $scope.sensorsInfo.Temperatures, record.sensors.Temperatures);
          $scope.sensorsInfo.Fans =
              [].concat($scope.sensorsInfo.Fans, record.sensors.Fans);
          $scope.sensorsInfo.Voltages =
              [].concat($scope.sensorsInfo.Voltages, record.sensors.Voltages);
        });
        // merge all sensors into one array
        // delay due to non-asynchronous call; TODO: set promise and $q.all
        // with one finally

        $timeout(function() {
          $scope.mergedSensors = $scope.sensorsInfo.Voltages.concat(
              $scope.sensorsInfo.Fans, $scope.sensorsInfo.Temperatures);
        }, 1500);


        $scope.mergedsensorsexport =
            ((JSON.stringify($scope.sensorsInfo.Voltages.concat(
                  $scope.sensorsInfo.Fans, $scope.sensorsInfo.Temperatures)))
                 .replace('[', ''))
                .replace(']', '');
        // encode # ins export
        var i = 0;
        var strLength = $scope.mergedsensorsexport.length;
        for (i; i < strLength; i++) {
          $scope.mergedsensorsexport =
              $scope.mergedsensorsexport.replace('#', '%23');
        }
        $scope.loading = false;
      };

      $scope.toggleSeverity = function(severity) {
        severity = $filter('lowercase')(severity);
        $scope.selectedSeverity = severity;
      };

      // delay due to non-asynchronous call; TODO: set promise and
      // $q.all with one finally
      $timeout(function() {
        $scope.showAlert();
        $scope.myEl.removeClass('sensor-hide');
      }, 1800);

      $scope.filterBySeverity = function(sensor) {
        if ($scope.selectedSeverity == 'all') return true;
        return (
            ((sensor.Status.Health == 'OK') &&
             ($scope.selectedSeverity == 'ok')) ||
            ((sensor.Status.Health == 'Warning') &&
             $scope.selectedSeverity == 'warning') ||
            ((sensor.Status.Health == 'Critical') &&
             $scope.selectedSeverity == 'critical'));
      };


      $scope.$watch('toggle', function() {
        //  $scope.toggleText = $scope.toggle ? 'Hide Thresholds' : 'Show
        //  Thresholds';
        $scope.toggleText = 'Show Thresholds';
        $scope.toggle ? $scope.showThresholds = true :
                        $scope.showThresholds = false;
      })

      $scope.showAlert = function() {
        $scope.severeNodesCount =
            $filter('filter')($scope.mergedSensors, 'critical').length;
        $scope.warningNodesCount =
            $filter('filter')($scope.mergedSensors, 'warning').length;

        if (($scope.severeNodesCount > 0 || $scope.warningNodesCount > 0) &&
            !$scope.suppressAlerts) {
          if ($scope.severeNodesCount) {
            $scope.alertloadMessage = $scope.severeNodesCount;
            $scope.severeNodesCount > 1 ?
                $scope.alertloadMessage = $scope.alertloadMessage + ' nodes' :
                $scope.alertloadMessage = $scope.alertloadMessage + ' node';
            $scope.alertloadMessage = $scope.alertloadMessage +
                ' at <b>critical</b> status level.<BR>';
          };
          if ($scope.warningNodesCount) {
            $scope.alertloadMessage =
                $scope.alertloadMessage + $scope.warningNodesCount;
            $scope.warningNodesCount > 1 ?
                $scope.alertloadMessage = $scope.alertloadMessage + ' nodes' :
                $scope.alertloadMessage = $scope.alertloadMessage + ' node';
            $scope.alertloadMessage =
                $scope.alertloadMessage + ' at <b>warning</b> status level.';
          };
          $scope.severeNodesCount ?
              toastService.alert($scope.alertloadMessage) :
              toastService.warning($scope.alertloadMessage);

          $scope.suppressAlerts = true;
        };
      };

      $scope.sortBy = function(keyname) {
        $scope.reverse = (keyname !== null && $scope.keyname === keyname) ?
            !$scope.reverse :
            false;
        $scope.keyname = keyname;
        $scope.sortKey = keyname;
      };

      $scope.sortBySeverity = function() {
        $scope.reverseSeverity = !$scope.reverseSeverity;
        $scope.sortKey = true;
        $scope.orderDatabySeverity();
      };

      $scope.toggleSeverity = function(severity) {
        severity = $filter('lowercase')(severity);
        $scope.selectedSeverity = severity;
      };

      $scope.orderDatabySeverity = function(val) {
        if ($scope.reverseSeverity) {
          return ['Critical', 'Warning', 'OK'].indexOf(val.Status.Health);
        } else {
          return ['Ok', 'Warning', 'Critical'].indexOf(val.Status.Health);
        }
      };

      $scope.selectComponent = function(val) {
        if (val == 'All') {
          $scope.filterByComponent = '';
        } else {
          $scope.filterByComponent = val;
        }
      };

      $scope.loadMergedSensors = function() {
        $scope.loading = true;
        // Flattened sensor data to display all sensors.
        $scope.sensorsInfo = {'Temperatures': [], 'Fans': [], 'Voltages': []};
        // Looping through all chassis collections to flattened sensors data
        angular.forEach($scope.fullSensorsInfo, function(record) {
          $scope.sensorsInfo.Temperatures = [].concat(
              $scope.sensorsInfo.Temperatures, record.sensors.Temperatures);
          $scope.sensorsInfo.Fans =
              [].concat($scope.sensorsInfo.Fans, record.sensors.Fans);
          $scope.sensorsInfo.Voltages =
              [].concat($scope.sensorsInfo.Voltages, record.sensors.Voltages);
        });
        // merge all sensors into one array
        // delay due to non-asynchronous call; TODO: set promise and $q.all
        // with one finally
        $timeout(function() {
          $scope.mergedSensors = $scope.sensorsInfo.Voltages.concat(
              $scope.sensorsInfo.Fans, $scope.sensorsInfo.Temperatures);
        }, 1500);
        $scope.loading = false;
      };

      function getComponentSensors(component) {
        var data = component;
        data['sensors'] = {'Temperatures': [], 'Fans': [], 'Voltages': []};
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
              $scope.loadMergedSensors();

              // delay due to non-asynchronous call; TODO: set promise and
              // $q.all with one finally
              $timeout(function() {
                $scope.showAlert();
                $scope.myEl.removeClass('sensor-hide');
              }, 1800);

              $scope.loading = false;
            });
        APIUtils.getSensorsInfo(component.Power['@odata.id'])
            .then(function(res) {
              if (res.hasOwnProperty('Voltages')) {
                data.sensors['Voltages'] = res.Voltages;
              }
              return;
            })
        return data;
      };

      $scope.$watch('toggle', function() {
        $scope.toggleText = 'Show Thresholds';
        $scope.toggle ? $scope.showThresholds = true :
                        $scope.showThresholds = false;
      });

      $scope.showAlert = function() {
        $scope.severeNodesCount =
            $filter('filter')($scope.mergedSensors, 'critical').length;
        $scope.warningNodesCount =
            $filter('filter')($scope.mergedSensors, 'warning').length;

        if (($scope.severeNodesCount > 0 || $scope.warningNodesCount > 0) &&
            !$scope.suppressAlerts) {
          if ($scope.severeNodesCount) {
            $scope.alertloadMessage = $scope.severeNodesCount;
            $scope.severeNodesCount > 1 ?
                $scope.alertloadMessage = $scope.alertloadMessage + ' sensors' :
                $scope.alertloadMessage = $scope.alertloadMessage + ' sensor';
            $scope.alertloadMessage = $scope.alertloadMessage +
                ' at <b>critical</b> status level.<BR>';
          };
          if ($scope.warningNodesCount) {
            $scope.alertloadMessage =
                $scope.alertloadMessage + $scope.warningNodesCount;
            $scope.warningNodesCount > 1 ?
                $scope.alertloadMessage = $scope.alertloadMessage + ' sensors' :
                $scope.alertloadMessage = $scope.alertloadMessage + ' sensor';
            $scope.alertloadMessage =
                $scope.alertloadMessage + ' at <b>warning</b> status level.';
          };
          $scope.severeNodesCount ?
              toastService.alert($scope.alertloadMessage) :
              toastService.warning($scope.alertloadMessage);

          $scope.suppressAlerts = true;
        };
      };

      $scope.loadSensorData = function() {
        $scope.loading = true;
        APIUtils.getAllChassisCollection().then(
            function(chassisList) {
              angular.forEach(chassisList, function(chassis) {
                var resData = getComponentSensors(chassis);
                $scope.fullSensorsInfo.push(resData);
              });
            },
            function(error) {
              console.log(JSON.stringify(error));
            })
      };

      $scope.loadSensorData();
    }
  ]);
})(angular);
