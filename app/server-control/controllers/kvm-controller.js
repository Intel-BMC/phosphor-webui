/**
 * Controller for KVM (Kernel-based Virtual Machine)
 *
 * @module app/serverControl
 * @exports kvmController
 * @name kvmController
 */

import RFB from '@novnc/novnc/core/rfb.js';

const DISCONNECT_TIMEOUT = 10;

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').controller('kvmController', [
    '$scope', 'dataService', '$location', '$log',
    function($scope, dataService, $location, $log) {
      $scope.currentUrl = $location.url();

      console.log('get kvm loca :', $location)
      const userValue = JSON.parse(sessionStorage.getItem('USER_PERMISSION'));
      if (userValue && userValue.RoleId &&
          userValue.RoleId != 'Administrator') {
        $location.url('/unauthorized');
      }
    }
  ]);
})(angular);
