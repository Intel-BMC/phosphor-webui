/**
 * data service
 *
 * @module app/common/services/dataService
 * @exports dataService
 * @name dataService

 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.common.services').service('dataService', [
    'Constants',
    function(Constants) {
      this.server_health = Constants.SERVER_HEALTH.unknown;
      this.server_state = 'Unreachable';
      this.LED_state = Constants.LED_STATE_TEXT.off;
      this.last_updated = new Date();

      this.loading = false;
      this.server_unreachable = false;
      this.showNavigation = false;
      this.bodyStyle = {};
      this.path = '';

      this.hostname = '';
      this.mac_address = '';
      this.defaultgateway = '';

      this.ignoreHttpError = false;
      this.systemName = '';

      this.configJson = require('../../../config.json');

      this.getServerId = function() {
        return this.host.replace(/^https?\:\/\//ig, '');
      };

      this.reloadServerId = function() {
        this.server_id = this.getServerId();
      };

      this.getHost = function() {
        if (sessionStorage.getItem(
                Constants.API_CREDENTIALS.host_storage_key) !== null) {
          return sessionStorage.getItem(
              Constants.API_CREDENTIALS.host_storage_key);
        } else {
          return Constants.API_CREDENTIALS.default_protocol + '://' +
              window.location.hostname +
              (window.location.port ? ':' + window.location.port : '');
        }
      };

      this.setHost = function(hostWithPort) {
        hostWithPort = hostWithPort.replace(/^https?\:\/\//ig, '');
        var hostURL =
            Constants.API_CREDENTIALS.default_protocol + '://' + hostWithPort;
        sessionStorage.setItem(
            Constants.API_CREDENTIALS.host_storage_key, hostURL);
        this.host = hostURL;
        this.reloadServerId();
      };

      this.getUser = function() {
        return sessionStorage.getItem('LOGIN_ID');
      };

      this.host = this.getHost();
      this.server_id = this.getServerId();
      this.user_id = this.getUser();

      this.setNetworkInfo = function(data) {
        this.hostname = data[0].HostName;
        // TODO: this value only is for the first ethernet connection; removed
        // since is not used
        // this.defaultgateway = data[0].IPv6DefaultGateway;
        // this.mac_address = data[0].MACAddress;
      };

      this.setPowerOnState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.on;
      };

      this.setPowerOffState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.off;
      };

      this.setPoweringOffState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.poweringoff;
      };

      this.setPoweringOnState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.poweringon;
      };

      this.setErrorState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.error;
      };

      this.setUnreachableState = function() {
        this.server_state = Constants.HOST_STATE_TEXT.unreachable;
      };

      this.updateServerHealth = function(healthStatus) {
        this.server_health = healthStatus;
      };

      this.setSystemName = function(sysName) {
        this.systemName = sysName;
      };
    }
  ]);
})(window.angular);