/**
 * Controller for power-usage
 *
 * @module app/serverControl
 * @exports powerUsageController
 * @name powerUsageController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').controller('powerUsageController', [
    '$scope', '$window', 'APIUtils', '$route', '$q', 'toastService',
    function($scope, $window, APIUtils, $route, $q, toastService) {
      $scope.power_consumption = '';
      $scope.power = {};
      $scope.power_cap = {};
      $scope.LimitException = '';
      $scope.powerCap = null;
      $scope.loading = false;
      $scope.editPowerCap = true;
      loadPowerData();

      function loadPowerData() {
        $scope.loading = true;

        var getPowerCapPromise =
            APIUtils.getChassisBaseboardUri().then(function(res) {
              APIUtils.getPowerCap().then(
                  function(data) {
                    $scope.power = data;
                    if ($scope.power) {
                      if ($scope.power.PowerSupplies &&
                          $scope.power.PowerSupplies[0]) {
                        $scope.power_consumption =
                            $scope.power.PowerSupplies[0].PowerInputWatts;
                      }
                      if ($scope.power.PowerControl &&
                          $scope.power.PowerControl[0]) {
                        const powerCap =
                            $scope.power.PowerControl[0].PowerLimit;
                        $scope.powerCap = powerCap.LimitInWatts;
                        $scope.LimitException = powerCap.LimitException;
                        $scope.power_cap.PowerCapEnable =
                            ($scope.powerCap && $scope.powerCap != 0)
                      }
                    }
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
            })

        var promises = [
          getPowerCapPromise,
        ];

        $q.all(promises).finally(function() {
          $scope.loading = false;
        });
      }

      $scope.unsetPowerCap = function() {
        const powerCap = $scope.power.PowerControl[0].PowerLimit;
        $scope.powerCap = powerCap.LimitInWatts;
      };

      $scope.setPowerCap = function() {
        // The power cap value will be undefined if outside range
        if (!$scope.powerCap) {
          toastService.error(
              'Power cap value between 100 and 10,000 is required');
          return;
        }
        $scope.loading = true;
        var promises = [setPowerCapValue()];

        $q.all(promises)
            .then(
                function() {
                  $scope.editPowerCap = true;
                  toastService.success('Power cap settings saved');
                },
                function(errors) {
                  $scope.unsetPowerCap();
                  $scope.power_cap.PowerCapEnable = false;
                  toastService.error('Power cap settings could not be saved');
                })
            .finally(function() {
              $scope.loading = false;
            });
      };

      $scope.refresh = function() {
        $route.reload();
      };

      function setPowerCapValue() {
        return APIUtils.setPowerCap($scope.powerCap)
            .then(
                function(data) {},
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      };

      function setPowerCapEnable() {
        return APIUtils.setPowerCapEnable($scope.power_cap.PowerCapEnable)
            .then(
                function(data) {},
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      }
    }
  ]);
})(angular);
