/**
 * Controller for bmc-reboot
 *
 * @module app/serverControl
 * @exports bmcRebootController
 * @name bmcRebootController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').controller('bmcRebootController', [
    '$scope', '$window', 'APIUtils', 'dataService', 'toastService', '$location',
    function($scope, $window, APIUtils, dataService, toastService, $location) {
      $scope.dataService = dataService;

      const userValue = JSON.parse(sessionStorage.getItem('USER_PERMISSION'));
      if (userValue && userValue.RoleId &&
          userValue.RoleId != 'Administrator') {
        $location.url('/unauthorized');
      }

      $scope.confirm = false;
      $scope.rebootConfirm = function() {
        if ($scope.confirm) {
          return;
        }
        $scope.confirm = true;
      };
      $scope.reboot = function() {
        APIUtils.bmcReboot().then(
            function(response) {
              toastService.success(
                  'BMC reboot action successful. BMC is rebooting...')
            },
            function(error) {
              console.log(JSON.stringify(error));
              toastService.error('Unable to perform BMC reboot action.');
            });
      };
    }
  ]);
})(angular);
