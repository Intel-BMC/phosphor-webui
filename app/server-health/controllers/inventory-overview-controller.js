/**
 * Controller for server
 *
 * @module app/serverHealth
 * @exports inventoryOverviewController
 * @name inventoryOverviewController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverHealth').controller('inventoryOverviewController', [
    '$scope', '$window', 'APIUtils', 'dataService', '$q',
    function($scope, $window, APIUtils, dataService, $q) {
      $scope.dataService = dataService;
      $scope.hardwares = [];
      $scope.originalData = {};
      $scope.customSearch = '';
      $scope.searchTerms = [];
      $scope.loading = true;
      $scope.hardwareList = ['All', 'CPUs', 'DIMMs', 'Drives', 'PCIe Devices'];
      $scope.selectedHardwareType = 'All';
      $scope.showDetails = true;
      $scope.toggleDrive = false;
      $scope.showasGroups = true;
      $scope.cpuLoading = true;
      $scope.dimmsLoading = true;
      $scope.drivesLoading = true;
      $scope.devicesLoading = true;

      loadData();

      $scope.toggleDrivedisabled = function() {
        $scope.toggleDrive = !$scope.toggleDrive;
      };

      $scope.filterByState = function(drive) {
        return ((drive.Status.State == 'Enabled') && (!$scope.toggleDrive)) ||
            ($scope.toggleDrive);
      };

      $scope.filterBySeverity = function(sensor) {
        if ($scope.selectedSeverity == 'all') return true;
        return (
            ((sensor.Status.Health == 'OK') &&
             ($scope.selectedSeverity == 'ok')) ||
            ((sensor.Status.Health == 'Warning') &&
             $scope.selectedSeverity == 'warning') ||
            ((sensor.Status.Health == 'Critical') &&
             $scope.selectedSeverity == 'critical'));
      };
      function loadData() {
        APIUtils.getCPUs()
            .then(
                function(result) {
                  console.log('get CPUs Data :', result);
                  result.forEach(element => {
                    if (element.ProcessorId) {
                      element['EffectiveFamily'] =
                          element.ProcessorId.EffectiveFamily;
                    }
                  });
                  $scope.CPUData = result;
                },
                function(error) {
                  console.log(JSON.stringify(error));
                })
            .finally(function() {
              $scope.cpuLoading = false;
            });

        APIUtils.getDIMMs()
            .then(
                function(result) {
                  $scope.DimmTable = result;
                },
                function(error) {
                  console.log(JSON.stringify(error));
                })
            .finally(function() {
              $scope.dimmsLoading = false;
            });

        APIUtils.getDrives()
            .then(
                function(result) {
                  $scope.DriveData = result;
                },
                function(error) {
                  console.log(JSON.stringify(error));
                })
            .finally(function() {
              $scope.drivesLoading = false;
            });

        APIUtils.getDevices()
            .then(
                function(result) {
                  console.log('inventory PCI Devices Data -> ', result)
                  $scope.PCIData = result;
                },
                function(error) {
                  console.log(JSON.stringify(error));
                })
            .finally(function() {
              $scope.devicesLoading = false;
            });
      }

      $scope.sortPCIBy = function(keyname, checkedGroup) {
        $scope.reverse = (keyname !== null && $scope.keyPCIname === keyname) ?
            !$scope.reverse :
            false;
        $scope.keyPCIname = keyname;
        // Once table is sorted, remove color styling & grouping so functions
        // can be sorted independently
        if (checkedGroup) {
          $scope.showasGroups = !$scope.showasGroups;
          $scope.sortPCIKey = ['ParentId', 'GroupedBy', keyname];
        } else {
          $scope.showasGroups = false;
          $scope.sortPCIKey = [keyname];
        };
      };

      $scope.sortBy = function(keyname) {
        $scope.reverse = (keyname !== null && $scope.keyname === keyname) ?
            !$scope.reverse :
            false;
        $scope.keyname = keyname;
        $scope.sortKey = keyname;
      };

      $scope.sortBySeverity = function() {
        $scope.reverseSeverity = !$scope.reverseSeverity;
        $scope.sortKey = true;
        $scope.orderDatabySeverity();
      };

      $scope.toggleSeverity = function(severity) {
        severity = $filter('lowercase')(severity);
        $scope.selectedSeverity = severity;
      };

      $scope.toggleHardware = function(hardwaretype) {
        $scope.selectedHardwareType = hardwaretype;
        $scope.clear();
      };

      $scope.orderDatabySeverity = function(val) {
        if ($scope.reverseSeverity) {
          return ['Critical', 'Warning', 'OK'].indexOf(val.Status.Health);
        } else {
          return ['Ok', 'Warning', 'Critical'].indexOf(val.Status.Health);
        }
      };

      $scope.clear = function() {
        $scope.customSearch = '';
        $scope.searchTerms = [];
      };

      $scope.doSearchOnEnter = function(event) {
        var search =
            $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
        if (event.keyCode === 13 && search.length >= 2) {
          $scope.searchTerms = $scope.customSearch.split(' ');
        } else {
          if (search.length == 0) {
            $scope.searchTerms = [];
          }
        }
      };

      $scope.doSearchOnClick = function() {
        var search =
            $scope.customSearch.replace(/^\s+/g, '').replace(/\s+$/g, '');
        if (search.length >= 2) {
          $scope.searchTerms = $scope.customSearch.split(' ');
        } else {
          if (search.length == 0) {
            $scope.searchTerms = [];
          }
        }
      };

      $scope.parseNonSpacedWords = function(str) {
        if (str) {
          str = str.slice((str.lastIndexOf('.') + 1), str.length);
          str = str.replace(/([a-z])([A-Z])/g, '$1 $2');
        };
        return str;
      };

      $scope.filterBySearchTerms = function(Dimm) {
        if (!$scope.searchTerms.length) return true;

        for (var i = 0, length = $scope.searchTerms.length; i < length; i++) {
          var search_text =
              Dimm.Id + ' ' + Dimm.DataWidthBits + ' ' + Dimm.MemoryType;
          if (search_text.indexOf($scope.searchTerms[i].toLowerCase()) == -1)
            return false;
        };
        return true;
      };

      $scope.filterBySearchTermsDrive = function(device) {
        if (!$scope.searchTerms.length) return true;

        for (var i = 0, length = $scope.searchTerms.length; i < length; i++) {
          var search_text = drive.PartNumber.toLowerCase() + ' ' +
              drive.SerialNumber.toLowerCase() + ' ' +
              drive.Manufacturer.toLowerCase() + ' ' +
              drive.Model.toLowerCase();
          if (search_text.indexOf($scope.searchTerms[i].toLowerCase()) == -1)
            return false;
        };
        return true;
      };


      $scope.filterBySearchTermsPCI = function(device) {
        if (!$scope.searchTerms.length) return true;

        for (var i = 0, length = $scope.searchTerms.length; i < length; i++) {
          var search_text = device.VendorId + ' ' + device.DeviceId + ' ' +
              device.Manufacturer.toLowerCase() + ' ' +
              device.DeviceClass.toLowerCase();
          if (search_text.indexOf($scope.searchTerms[i].toLowerCase()) == -1)
            return false;
        };
        return true;
      };

      $scope.filterBySearchTermsCPU = function(CPU) {
        if (!$scope.searchTerms.length) return true;

        for (var i = 0, length = $scope.searchTerms.length; i < length; i++) {
          var search_text = CPU.Id + CPU.PartNumber.toLowerCase() + ' ' +
              CPU.Manufacturer.toLowerCase() + ' ' + CPU.Model.toLowerCase();

          if (search_text.indexOf($scope.searchTerms[i].toLowerCase()) == -1)
            return false;
        };
        return true;
      };

      $scope.filterDimms = function(dimm) {
        if (dimm.Status.State == 'Enabled') {
          return true;
        };
      };
    }
  ]);
})(angular);