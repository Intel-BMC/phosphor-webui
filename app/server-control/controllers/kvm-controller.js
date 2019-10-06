/**
 * Controller for KVM (Kernel-based Virtual Machine)
 *
 * @module app/serverControl
 * @exports kvmController
 * @name kvmController
 */

import RFB from '@novnc/novnc/core/rfb.js';

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').controller('kvmController', [
    '$scope', 'dataService', '$location', '$log',
    function($scope, dataService, $location, $log) {
      var rfb;
      $scope.autoscale = true;

      $scope.$on('$destroy', function() {
        if (rfb) {
          rfb.disconnect();
        }
      });

      function sendCtrlAltDel() {
        rfb.sendCtrlAltDel();
        return false;
      };

      function connected(e) {
        $log.debug('RFB Connected');
      }
      function disconnected(e) {
        $log.debug('RFB disconnected');
      }

      var host = dataService.server_id;

      var target =
          angular.element(document.querySelector('#noVNC_container'))[0];

      try {
        rfb = new RFB(target, 'wss://' + host + '/kvm/0', {});

        rfb.addEventListener('connect', connected);
        rfb.addEventListener('disconnect', disconnected);
      } catch (exc) {
        $log.error(exc);
        updateState(
            null, 'fatal', null, 'Unable to create RFB client -- ' + exc);
        return;  // don't continue trying to connect
      };

      $scope.windowreload = function(autoscale) {
        if (autoscale) {
          var myEl =
              angular.element(document.querySelector('#noVNC_container'));
          myEl.addClass('enforceAdjustment');
          // reload to force autoscale when toggled twice; TODO: could check
          // height and only reload if window is less than height of noVNC
          location.reload();
        };
      };
      // on toggle, class "enforceAdjustment" override needed
      // However the class must be removed on resize to keep cursor tracking
      $scope.set_rfbScale = function(displayScale) {
        rfb.clipViewport = displayScale;
        rfb.scaleViewport = displayScale;
      };

      $scope.set_rfbScale($scope.autoscale);
    }
  ]);
})(angular);
