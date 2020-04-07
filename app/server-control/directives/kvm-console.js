/**
 * Directive for KVM (Kernel-based Virtual Machine)
 *
 * @module app/serverControl
 * @exports kvmConsole
 * @name kvmConsole
 */

import RFB from '@novnc/novnc/core/rfb.js';

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').directive('kvmConsole', [
    '$log', '$cookies', 'dataService', '$location',
    function($log, $cookies, dataService, $location) {
      return {
        restrict: 'E', template: require('./kvm-console.html'),
            scope: {newWindowBtn: '=?'}, link: function(scope, element) {
              var rfb;
              scope.autoscale = true;

              element.on('$destroy', function() {
                if (rfb) {
                  rfb.disconnect();
                }
              });

              scope.sendCtrlAltDel = function() {
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
              var target = angular.element(
                  document.querySelector('#noVNC_container'))[0];

              try {
                var token = $cookies.get('XSRF-TOKEN');
                rfb = new RFB(
                    target, 'wss://' + host + '/kvm/0',
                    {'wsProtocols': [token]});

                rfb.addEventListener('connect', connected);
                rfb.addEventListener('disconnect', disconnected);
              } catch (exc) {
                $log.error(exc);
                updateState(
                    null, 'fatal', null,
                    'Unable to create RFB client -- ' + exc);
                return;  // don't continue trying to connect
              };

              scope.windowreload = function(autoscale) {
                if (autoscale) {
                  var myEl = angular.element(
                      document.querySelector('#noVNC_container'));
                  myEl.addClass('enforceAdjustment');
                  // reload to force autoscale when toggled twice; TODO: could
                  // check height and only reload if window is less than height
                  // of noVNC
                  location.reload();
                };
              };

              scope.close = function() {
                window.close();
                if (rfb) {
                  rfb.disconnect();
                }
              };

              // on toggle, class "enforceAdjustment" override needed
              // However the class must be removed on resize to keep cursor
              // tracking
              scope.set_rfbScale = function(displayScale) {
                rfb.clipViewport = displayScale;
                rfb.scaleViewport = displayScale;
              };

              scope.set_rfbScale(scope.autoscale);

              scope.openWindow = function() {
                window.open(
                    '#/server-control/kvm-window', 'Kvm Window',
                    'directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=yes,width=1125,height=900');
              };
            }
      }
    }
  ]);
})(window.angular);
