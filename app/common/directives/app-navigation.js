window.angular && (function(angular) {
  'use strict';

  angular.module('app.common.directives')
      .directive('appNavigation', function() {
        return {
          'restrict': 'E',
          'template': require('./app-navigation.html'),
          'scope': {'path': '=', 'showNavigation': '='},
          'controller': [
            '$scope', '$rootScope', '$location', 'dataService',
            function($scope, $rootScope, $location, dataService) {
              $scope.dataService = dataService;
              var configJSON = require('../../../config.json');
              if (configJSON.VirtualMediaEnabled == true) {
                $scope.VMEnabled = true;
              } else {
                $scope.VMEnabled = false;
              }

              $scope.checkPrivilege = function(requiredPriv) {
                const userValue =
                    JSON.parse(sessionStorage.getItem('USER_PERMISSION'));
                if (userValue && userValue.RoleId) {
                  if (requiredPriv == 'Administrator') {
                    return userValue.RoleId === 'Administrator';
                  } else if (requiredPriv == 'Operator') {
                    return (
                        (userValue.RoleId === 'Administrator') ||
                        (userValue.RoleId === 'Operator'));
                  } else if (requiredPriv == 'ReadOnly') {
                    return (
                        (userValue.RoleId === 'Administrator') ||
                        (userValue.RoleId === 'Operator') ||
                        (userValue.RoleId === 'ReadOnly'));
                  }
                  return false;
                } else {
                  return false;
                }
              };

              $scope.$watch('toggleNav', function() {
                $rootScope.toggleNavState = $scope.toggleNav;
              });

              $scope.change = function(firstLevel) {
                if (firstLevel != $scope.firstLevel) {
                  $scope.firstLevel = firstLevel;
                  $scope.showSubMenu = true;
                } else {
                  $scope.showSubMenu = !$scope.showSubMenu;
                }
              };

              $scope.RedirectToURL = function(destinationURL) {
                $location.url(destinationURL);
              };

              $scope.$watch('path', function() {
                var urlRoot = $location.path().split('/')[1];
                if (urlRoot != '') {
                  $scope.firstLevel = urlRoot;
                } else {
                  $scope.firstLevel = 'overview';
                }
                $scope.showSubMenu = true;
              });

              $scope.$watch('showNavigation', function() {
                var urlRoot = $location.path().split('/')[1];
                if (urlRoot != '') {
                  $scope.firstLevel = urlRoot;
                } else {
                  $scope.firstLevel = 'overview';
                }
              });
            }
          ],
          link: function(scope, element, attributes) {
            var rawNavElement = angular.element(element)[0];
            angular.element(window.document).bind('click', function(event) {
              if (rawNavElement.contains(event.target)) return;

              if (scope.showSubMenu) {
                scope.$apply(function() {
                  scope.showSubMenu = true;
                });
              }
            });
          }
        };
      });
})(window.angular);