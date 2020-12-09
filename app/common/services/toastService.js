/**
 * toast service
 *
 * @module app/common/services/toastService
 * @exports toastService
 * @name toastService

 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.common.services').service('toastService', [
    'toaster', '$sce',
    function(toaster, $sce) {
      function initToast(
          type = 'info', title = '', message = '', timeout = 10000) {
        toaster.pop({
          type: type,
          title: title,
          body: message,
          bodyOutputType: 'trustedHtml',
          timeout: timeout,
          showCloseButton: true,
          tapToDismiss: true
        });
      };

      this.error = function(message) {
        initToast('error', 'Error!', message);
      };

      this.success = function(message) {
        initToast('success', 'Success!', message, true);
      };

      this.warning = function(message) {
        initToast('warning', 'Warning!', message);
      };

      this.info = function(title, message) {
        initToast('note', title, message);
      };
      this.alert = function(message) {
        initToast('error', 'Error!', message);
      };
    }
  ]);
})(window.angular);
