window.angular && (function(angular) {
  'use strict';

  angular.module('app.common.directives').directive('appHeader', [
    'APIUtils',
    function(APIUtils) {
      return {
        'restrict': 'E',
        'template': require('./app-header.html'),
        'scope': {'path': '='},
        'title': 'No title',
        'controller': [
          '$rootScope', '$scope', 'dataService', 'Constants', 'userModel',
          '$location', '$route',
          function(
              $rootScope, $scope, dataService, Constants, userModel, $location,
              $route) {
            $scope.dataService = dataService;

            $scope.page_title = $rootScope.page_title;
            $scope.$on('$routeChangeSuccess', function(event, data) {
              $scope.page_title = data.title;
            });

            $scope.page_title = $rootScope.page_title;

            $scope.$on('$routeChangeSuccess', function(event, data) {
              $scope.page_title = data.title;
            });

            $scope.loadServerHealth = function() {
              APIUtils.getServerStatus().then(function(result) {
                if (result && result.Status) {
                  dataService.updateServerHealth(result.Status.Health);
                }
              });
            };

            $scope.loadServerStatus = function() {
              if (!userModel.isLoggedIn()) {
                return;
              }
              APIUtils.getServerStatus().then(
                  function(result) {
                    if (result &&
                        result.PowerState == Constants.HOST_STATE_TEXT.off) {
                      dataService.setPowerOffState();
                    } else if (
                        result &&
                        result.PowerState == Constants.HOST_STATE_TEXT.on) {
                      dataService.setPowerOnState();
                    } else if (
                        result &&
                        result.PowerState ==
                            Constants.HOST_STATE_TEXT.poweringoff) {
                      dataService.setPowerOnState();
                    } else if (
                        result &&
                        result.PowerState ==
                            Constants.HOST_STATE_TEXT.poweringon) {
                      dataService.setPowerOnState();
                    } else {
                      dataService.setErrorState();
                    };
                  },
                  function(error) {
                    console.log(error);
                  });
            };

            $scope.loadNetworkInfo = function() {
              if (!userModel.isLoggedIn()) {
                return;
              }
              // TODO: change to Redfish then can uncomment
              APIUtils.getNetworkInfo().then(function(data) {
                dataService.setNetworkInfo(data);
              });
            };

            $scope.loadSystemName = function() {
              // Dynamically get ComputerSystems Name/serial
              // which differs across OEM's
              APIUtils.getRedfishSysName().then(
                  function(res) {
                    dataService.setSystemName(res);
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
            };

            function loadData() {
              $scope.loadServerStatus();
              $scope.loadNetworkInfo();
              $scope.loadServerHealth();
              $scope.loadSystemName();
            }

            loadData();

            var myUsername = sessionStorage.getItem('LOGIN_ID');

            $scope.logout = function() {
              userModel.logout(function(status, error) {
                if (status) {
                  $location.path('/logout');
                } else {
                  console.log(error);
                }
              });
            };

            $scope.refresh = function() {
              // reload current page controllers and header
              loadData();
              $route.reload();
              // Add flash class to header timestamp on click of refresh
              var myEl =
                  angular.element(document.querySelector('.header__refresh'));
              myEl.addClass('flash');
              setTimeout(function() {
                myEl.removeClass('flash');
              }, 2000);
            };

            var loginListener =
                $rootScope.$on('user-logged-in', function(event, arg) {
                  loadData();
                });
            $scope.$on('$destroy', function() {
              loginListener();
            });
          }
        ]
      };
    }
  ]);
})(window.angular);
