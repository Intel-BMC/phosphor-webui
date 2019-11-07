window.angular && (function(angular) {
  'use strict';

  /**
   * statusIcon Component
   *
   * To use:
   * The <status-icon> component expects a 'status' attribute
   * with a status value (on, off, warn, error)
   *
   */

  /**
   * statusIcon Component template
   */
  const template = `<icon ng-if="$ctrl.status === 'on'"
                                  file="checkmark--filled.svg"
                                  aria-hidden="true"
                                  class="status-icon status-on">
                            </icon>
                            <icon ng-if="$ctrl.status === 'off'"
                                  file="icon-off.svg"
                                  aria-hidden="true"
                                  class="status-icon status-off">
                            </icon>
                            <icon ng-if="$ctrl.status === 'warn'"
                                  file="warning--filled.svg"
                                  aria-hidden="true"
                                  class="status-icon status-warn">
                            </icon>
                            <icon ng-if="$ctrl.status === 'error'"
                                  file="warning--filled-sm.svg"
                                  aria-hidden="true"
                                  class="status-icon status-error">
                            </icon>`

  /**
   * Register statusIcon component
   */
  angular.module('app.common.components')
      .component('statusIcon', {template, bindings: {status: '@'}})
})(window.angular);