/**
 * Controller for date-time
 *
 * @module app/configuration
 * @exports dateTimeController
 * @name dateTimeController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.configuration').controller('dateTimeController', [
    '$scope', 'APIUtils', '$filter', '$route', '$q', 'toastService', '$timeout',
    function($scope, APIUtils, $filter, $route, $q, toastService, $timeout) {
      $scope.editNTPSettings = [];
      $scope.ntp = {servers: []};
      $scope.editNTPSettings = {};
      $scope.use = 'Server';

      var getNTPServerStatus = APIUtils.getNTPValues().then(
          function(data) {
            $scope.useNTP = data.NTP.ProtocolEnabled;
            $scope.ntp.servers = data.NTP.NTPServers;
            if ($scope.useNTP) {
              $scope.use = 'NTP';
            } else {
              $scope.use = 'Server';
            };
          },
          function(error) {
            console.log(JSON.stringify(error));
          });

      var getBMCTimePromise = APIUtils.getBMCTime().then(
          function(data) {
            $scope.UTCTime = data.DateTime;
          },
          function(error) {
            console.log(JSON.stringify(error));
          });

      $scope.saveDateTimeSettings = function() {
        if ($scope.use == 'NTP') {
          $scope.useNTP = true;
        } else {
          $scope.useNTP = false;
        };

        // don't save NTP server as date owner if NTP servers are all blank
        if ((($scope.ntp.servers.length != 0) && $scope.useNTP) ||
            (!$scope.useNTP)) {
          $scope.loading = true;
          setNTPServers()
              .then(setTimeOwner)
              .then(
                  function() {
                    toastService.success('Date and time settings saved');
                  },
                  function(errors) {
                    console.log(JSON.stringify(errors));
                    toastService.error(
                        'Date and time settings could not be saved');
                  })
              .finally(function() {
                $scope.loading = false;
              });
        };
      };

      $scope.refresh = function() {
        //  $route.reload();
      };

      $scope.updatedRow = function() {
        $scope.rowUpdate = true;
      };

      $scope.addNTPField = function(newRow) {
        $scope.editNTPSettings[$scope.ntp.servers.length] = true;
        if ((newRow && $scope.ntp.servers == false) || !newRow) {
          $scope.ntp.servers.push('');
        }
      };

      $scope.removeNTPField = function(index) {
        $scope.updatedRow();
        $scope.ntp.servers.splice(index, 1);
      };

      function setNTPServers() {
        // Remove any empty strings from the array. If the
        // user doesn't fill out the field, we don't want to add.
        $scope.ntp.servers = $scope.ntp.servers.filter(Boolean);

        return APIUtils.setNTPServers($scope.ntp.servers);
      }

      function setTimeOwner() {
        return APIUtils.setNTPEnabled($scope.useNTP);
      }

      $scope.loading = true;
      var promises = [getNTPServerStatus, getBMCTimePromise];

      $q.all(promises).finally(function() {
        $scope.loading = false;
      });
    }
  ]);
})(angular);