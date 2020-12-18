/**
 * Controller for the login page
 *
 * @module app/login/controllers/index
 * @exports LoginController
 * @name LoginController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.login').controller('LoginController', [
    '$scope',
    '$window',
    'dataService',
    'userModel',
    '$location',
    'APIUtils',
    function($scope, $window, dataService, userModel, $location, APIUtils) {
      $scope.dataService = dataService;
      $scope.serverUnreachable = false;
      $scope.invalidCredentials = false;
      $scope.host = $scope.dataService.host;

      var login_func = function(status, description) {
        if (status) {
          $scope.$emit('user-logged-in', {});
          var next = $location.search().next;
          // don't allow forwarding to non-local urls
          if (next === undefined || next == null) {
            $window.location.hash = '#/overview/server';
          } else if (next) {
            const invalidChar =
                (next.indexOf('(') >= 0 || next.indexOf(')') >= 0 ||
                 next.indexOf('.') >= 0 || next.indexOf(':') >= 0 ||
                 next.indexOf('//') >= 0);
            if (invalidChar) {
              $window.location.hash = '#/overview/server';
            } else {
              $window.location.href = next;
            }
          }
        } else {
          if (description === 'Unauthorized') {
            $scope.invalidCredentials = true;
          } else {
            $scope.serverUnreachable = true;
          }
        }
      };

      APIUtils.isUserAuthenticated().then(auth => {
        if (auth) {
          login_func(true, 'Okay');
        }
      });

      $scope.tryLogin = function(host, username, password, event) {
        // keyCode 13 is the 'Enter' button. If the user hits 'Enter' while in
        // one of the 3 fields, attempt to log in.
        if (event.keyCode === 13) {
          $scope.login(host, username, password);
        }
      };
      $scope.login = function(host, username, password) {
        $scope.serverUnreachable = false;
        $scope.invalidCredentials = false;
        if (!username || username == '' || !password || password == '' ||
            !host || host == '') {
          return false;
        } else {
          $scope.dataService.setHost(host);
          userModel.login(username, password, login_func);
        }
      };
    },
  ]);
})(angular);
