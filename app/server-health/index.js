/**
 * A module for the serverHealth
 *
 * @module app/server-health/index
 * @exports app/server-health/index
 */

window.angular && (function(angular) {
  'use strict';

  angular
      .module('app.serverHealth', ['ngRoute', 'app.common.services'])
      // Route configuration
      .config([
        '$routeProvider',
        function($routeProvider) {
          $routeProvider
              .when('/server-health/inventory-overview', {
                title: 'Hardware',
                'template':
                    require('./controllers/inventory-overview-controller.html'),
                'controller': 'inventoryOverviewController',
                authenticated: true
              })
              .when('/server-health/sensors-overview', {
                title: 'Sensors',
                'template':
                    require('./controllers/sensors-overview-controller.html'),
                'controller': 'sensorsOverviewController',
                authenticated: true
              })
              .when('/server-health/sys-log', {
                title: 'Event Log',
                'template': require('./controllers/syslog-controller.html'),
                'controller': 'sysLogController',
                authenticated: true
              })
              .when('/server-health', {
                title: 'Event Log',
                'template': require('./controllers/syslog-controller.html'),
                'controller': 'logController',
                authenticated: true
              });
        }
      ]);
})(window.angular);
