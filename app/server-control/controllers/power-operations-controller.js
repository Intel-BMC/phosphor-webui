/**
 * Controller for power-operations
 *
 * @module app/serverControl
 * @exports powerOperationsController
 * @name powerOperationsController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.serverControl').controller('powerOperationsController', [
    '$scope', '$location', 'APIUtils', 'dataService', 'Constants', '$interval',
    '$q', 'toastService', '$uibModal',
    function(
        $scope, $location, APIUtils, dataService, Constants, $interval, $q,
        toastService, $uibModal) {
      $scope.dataService = dataService;

      // Is a || of the other 4 "confirm" variables to ensure only
      // one confirm is shown at a time.
      $scope.dataService = dataService;

      $scope.loading = false;
      $scope.oneTimeBootEnabled = false;
      $scope.bootOverrideError = false;
      $scope.bootSources = [];
      $scope.boot = {};
      $scope.defaultRebootSetting = 'warm-reboot';
      $scope.defaultShutdownSetting = 'warm-shutdown';
      $scope.status = '';
      $scope.activeModal;
      $scope.flag = true;

      const userValue = JSON.parse(sessionStorage.getItem('USER_PERMISSION'));
      if (userValue && userValue.RoleId && userValue.RoleId != 'Operator' &&
          userValue.RoleId != 'Administrator') {
        $location.url('/unauthorized');
      }

      // When a power operation is in progress, set to true,
      // when a power operation completes (success/fail) set to false.
      // This property is used to show/hide the 'in progress' message
      // in markup.
      $scope.operationPending = false;

      const modalTemplate = require('./power-operations-modal.html');

      const powerOperations =
          {WARM_REBOOT: 0, COLD_REBOOT: 1, WARM_SHUTDOWN: 2, COLD_SHUTDOWN: 3};

      /**
       * Checks the host status provided by the dataService using an
       * interval timer
       * @param {string} statusType : host status type to check for
       * @param {number} timeout : timeout limit, defaults to 1 minutes
       * @param {string} error : error message, defaults to 'Time out'
       * @returns {Promise} : returns a deferred promise that will be fulfilled
       * if the status is met or be rejected if the timeout is reached
       */
      const checkHostStatus =
          (serverOperation, statusType, timeout = 60000,
           error = 'Time out.') => {
            const deferred = $q.defer();
            const start = new Date();
            const checkHostStatusInterval = $interval(() => {
              let now = new Date();
              let timePassed = now.getTime() - start.getTime();
              if (timePassed > timeout) {
                setPowerState();
                toastService.error(error);
                deferred.reject(error);
                $interval.cancel(checkHostStatusInterval);
              }
              // we need to call API to get server_state information
              // and check condition, if true then resolve
              APIUtils.getServerStatus().then(
                  function(result) {
                    if (result) {
                      $scope.status = result.PowerState;
                      console.log(
                          'PowerState :', result.PowerState,
                          '& status :', statusType);
                      if (serverOperation === 'reboot' &&
                          result.PowerState === Constants.HOST_STATE_TEXT.on) {
                        setPowerState();
                        deferred.resolve();
                        $interval.cancel(checkHostStatusInterval);
                        if ($scope.flag) {
                          toastService.success(
                              'Power ' + result.PowerState + ' successful');
                          $scope.flag = false;
                        }
                      } else if (result.PowerState === statusType) {
                        setPowerState();
                        deferred.resolve();
                        $interval.cancel(checkHostStatusInterval);
                        if ($scope.flag) {
                          toastService.success(
                              'Power ' + result.PowerState + ' successful');
                        }
                      };
                    };
                  },
                  function(error) {
                    console.log(error);
                  });
            }, Constants.POLL_INTERVALS.POWER_OP);
            return deferred.promise;
          };

      /**
       * Set server state (On/Off)
       */
      const setPowerState = () => {
        if (Constants.HOST_STATE_TEXT.on === $scope.status) {
          dataService.setPowerOnState();
        } else if (Constants.HOST_STATE_TEXT.off === $scope.status) {
          dataService.setPowerOffState();
        }
      };

      /**
       * Initiate Orderly reboot
       * Attempts to stop all software
       */
      const warmReboot = () => {
        $scope.operationPending = true;
        $scope.loading = true;
        dataService.setUnreachableState();
        APIUtils.gracefulRestart()
            .then(() => {
              // Check for off state
              $scope.loading = false;
              return checkHostStatus(
                  'reboot', Constants.HOST_STATE_TEXT.off,
                  Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT);
            })
            .then(() => {
              // Check for on state
              if ($scope.status === Constants.HOST_STATE_TEXT.on) {
                dataService.setUnreachableState();
              }
              return checkHostStatus(
                  'reboot', Constants.HOST_STATE_TEXT.on,
                  Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_ON_TIMEOUT);
            })
            .catch(error => {
              console.log(error);
              toastService.error(
                  Constants.MESSAGES.POWER_OP.WARM_REBOOT_FAILED);
            })
            .finally(() => {
              $scope.operationPending = false;
              $scope.loading = false;
            });
      };

      /**
       * Initiate Immediate reboot
       * Does not attempt to stop all software
       */
      const coldReboot = () => {
        $scope.operationPending = true;
        $scope.loading = true;
        dataService.setUnreachableState();
        APIUtils.forceOff()
            .then(() => {
              // Check for off state
              $scope.loading = false;
              return checkHostStatus(
                  'reboot', Constants.HOST_STATE_TEXT.off,
                  Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT);
            })
            .then(() => {
              $scope.loading = false;
              if ($scope.status === Constants.HOST_STATE_TEXT.on) {
                dataService.setUnreachableState();
              }
              return APIUtils.hostPowerOn();
            })
            .then(() => {
              // Check for on state
              return checkHostStatus(
                  '', Constants.HOST_STATE_TEXT.on, Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_ON_TIMEOUT);
            })
            .catch(error => {
              console.log(error);
              toastService.error(
                  Constants.MESSAGES.POWER_OP.COLD_REBOOT_FAILED);
            })
            .finally(() => {
              $scope.operationPending = false;
              $scope.loading = false;
            });
      };

      /**
       * Initiate any shutdown
       * Attempts to stop all software
       */
      const orderlyShutdown = () => {
        $scope.operationPending = true;
        $scope.loading = true;
        dataService.setUnreachableState();
        APIUtils.gracefulShutdown()
            .then(() => {
              // Check for off state
              $scope.loading = false;
              return checkHostStatus(
                  '', Constants.HOST_STATE_TEXT.off,
                  Constants.TIMEOUT.HOST_OFF_IMMEDIATE,
                  Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT);
            })
            .catch(error => {
              console.log(error);
              toastService.error(
                  Constants.MESSAGES.POWER_OP.ORDERLY_SHUTDOWN_FAILED);
            })
            .finally(() => {
              $scope.operationPending = false;
              $scope.loading = false;
            });
      };

      /**
       * Initiate Immediate shutdown
       * Does not attempt to stop all software
       */
      const immediateShutdown = () => {
        $scope.loading = true;
        $scope.operationPending = true;
        dataService.setUnreachableState();
        APIUtils.forceOff()
            .then(() => {
              // Check for off state
              $scope.loading = false;
              return checkHostStatus(
                  '', Constants.HOST_STATE_TEXT.off,
                  Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT);
            })
            .then(() => {
              $scope.loading = false;
              dataService.setPowerOffState();
            })
            .catch(error => {
              console.log(error);
              toastService.error(
                  Constants.MESSAGES.POWER_OP.IMMEDIATE_SHUTDOWN_FAILED);
            })
            .finally(() => {
              $scope.operationPending = false;
              $scope.loading = false;
            });
      };

      /**
       * Initiate Power on
       */
      $scope.powerOn = () => {
        $scope.loading = true;
        $scope.operationPending = true;
        dataService.setUnreachableState();
        APIUtils.hostPowerOn()
            .then(() => {
              // Check for on state
              $scope.loading = false;
              return checkHostStatus(
                  '', Constants.HOST_STATE_TEXT.on, Constants.TIMEOUT.HOST_FAST,
                  Constants.MESSAGES.POLL.HOST_ON_TIMEOUT);
            })
            .catch(error => {
              console.log(error);
              toastService.error(Constants.MESSAGES.POWER_OP.POWER_ON_FAILED);
            })
            .finally(() => {
              $scope.operationPending = false;
              $scope.loading = false;
            });
      };

      /**
       * Callback when 'Boot settings' button clicked
       */
      $scope.onClickBootSettings = () => {
        initBootSettingsModal();
      };

      /**
       * Initiate account settings modal
       */
      function initBootSettingsModal() {
        const template = require('./power-operations-settings-modal.html');
        $uibModal
            .open({
              template,
              windowTopClass: 'uib-modal',
              scope: $scope,
              ariaLabelledBy: 'modal-operation',
            })
            .result
            .then((form) => {
              saveBootSettings();
            })
            .catch(
                () => {
                    // do nothing
                })
      }
      /*
       *  Power operations modal
       */
      const initPowerOperation = function(powerOperation) {
        switch (powerOperation) {
          case powerOperations.WARM_REBOOT:
            warmReboot();
            break;
          case powerOperations.COLD_REBOOT:
            coldReboot();
            break;
          case powerOperations.WARM_SHUTDOWN:
            orderlyShutdown();
            break;
          case powerOperations.COLD_SHUTDOWN:
            immediateShutdown();
            break;
          default:
            // do nothing
        }
      };

      const powerOperationModal = function() {
        $scope.flag = true;
        $uibModal
            .open({
              template: modalTemplate,
              windowTopClass: 'uib-modal',
              scope: $scope,
              ariaLabelledBy: 'modal-operation'
            })
            .result
            .then(function(activeModal) {
              initPowerOperation(activeModal);
            })
            .finally(function() {
              $scope.activeModal = undefined;
            });
      };

      $scope.rebootConfirmModal = function() {
        if ($scope.rebootForm.radioReboot.$modelValue == 'warm-reboot') {
          $scope.activeModal = powerOperations.WARM_REBOOT;
        } else if ($scope.rebootForm.radioReboot.$modelValue == 'cold-reboot') {
          $scope.activeModal = powerOperations.COLD_REBOOT;
        }
        powerOperationModal();
      };

      $scope.shutdownConfirmModal = function() {
        if ($scope.shutdownForm.radioShutdown.$modelValue == 'warm-shutdown') {
          $scope.activeModal = powerOperations.WARM_SHUTDOWN;
        } else if (
            $scope.shutdownForm.radioShutdown.$modelValue == 'cold-shutdown') {
          $scope.activeModal = powerOperations.COLD_SHUTDOWN;
        }
        powerOperationModal();
      };

      $scope.resetForm = function() {
        $scope.boot = angular.copy($scope.originalBoot);
        $scope.TPMToggle = angular.copy($scope.originalTPMToggle);
        $scope.TPMVersion = angular.copy($scope.originalTPMVersion);
      };

      /*
       *   Get boot settings
       */
      const loadBootSettings = function() {
        $scope.loading = true;
        APIUtils.getBootOptions()
            .then(function(response) {
              const boot = response.Boot;
              const BootSourceOverrideEnabled =
                  boot['BootSourceOverrideEnabled'];
              const BootSourceOverrideTarget = boot['BootSourceOverrideTarget'];
              const bootSourceValues =
                  boot['BootSourceOverrideTarget@Redfish.AllowableValues'];

              $scope.bootSources = bootSourceValues;

              $scope.boot = {
                BootSourceOverrideEnabled: BootSourceOverrideEnabled,
                BootSourceOverrideTarget: BootSourceOverrideTarget
              };

              if (BootSourceOverrideEnabled == 'Once') {
                $scope.boot.oneTimeBootEnabled = true;
              }

              $scope.originalBoot = angular.copy($scope.boot);
            })
            .catch(function(error) {
              $scope.bootOverrideError = true;
              toastService.error('Unable to get boot override values.');
              console.log(
                  'Error loading boot settings:', JSON.stringify(error));
            })
            .finally(function() {
              $scope.loading = false;
            });
      };

      /*
       *   Get TPM status
       */
      const loadTPMStatus = function() {
        // TO DO: Redfish currently does not include TPM policy; function below
        // to be updated once it's completed
        $scope.loading = true;
        APIUtils.getTPMStatus()
            .then(function(response) {
              $scope.TPMVersion = response.data(TrustedModules.InterfaceType);
              if ($scope.TPMVersion) {
                $scope.TPMToggle = true;
              }
              $scope.originalTPMToggle = angular.copy($scope.TPMToggle);
              $scope.originalTPMVersion = angular.copy($scope.TPMVersion);
            })
            .catch(function(error) {
              //  toastService.error('Unable to get TPM policy status.');
              console.log('Error loading TPM status', JSON.stringify(error));
            })
            .finally(function() {
              $scope.loading = false;
            });
      };

      /*
       *   Prettify boot Target
       */
      $scope.prettifyBootTarget = function(bootTarget) {
        if (bootTarget != 'None' && bootTarget != null) {
          return bootTarget.replace('Cd', 'CD')
              .replace('Pxe', 'PXE')
              .replace('Hdd', 'Hard Drive')
              .replace('Diags', 'Diagnostics')
              .replace('BiosSetup', 'BIOS Setup')
              .replace('Usb', 'USB')
        } else {
          return 'No override';
        }
      };

      /*
       *   Save boot settings
       */
      $scope.saveBootSettings = function(bootSelectedDirty, oneTimeDirty) {
        if (bootSelectedDirty || oneTimeDirty) {
          const data = {};
          data.Boot = {};

          let isOneTimeBoot = $scope.boot.oneTimeBootEnabled;
          let overrideTarget = $scope.boot.BootSourceOverrideTarget || 'None';
          let overrideEnabled = 'Disabled';
          if (isOneTimeBoot) {
            overrideEnabled = 'Once';
          } else if (overrideTarget !== 'None') {
            overrideEnabled = 'Continuous';
          }
          data.Boot.BootSourceOverrideEnabled = overrideEnabled;
          data.Boot.BootSourceOverrideTarget = overrideTarget;
          $scope.loading = true;
          APIUtils.saveBootSettings(data).then(
              function(response) {
                $scope.originalBoot = angular.copy($scope.boot);
                toastService.success('Successfully updated boot settings.');
                $scope.loading = false;
              },
              function(error) {
                toastService.error('Unable to save boot settings.');
                console.log(JSON.stringify(error));
                $scope.loading = false;
              })
        }
      };

      /*
       *   Save TPM required policy
       */
      $scope.saveTPMPolicy = function(toggleDirty) {
        // TO DO: Redfish currently does not include TPM policy; function below
        // to be updated once it's completed
        if (toggleDirty) {
          const tpmEnabled = $scope.TPMToggle.TPMEnable;
          const tpmVersion = $scope.TPMToggle.TPMversion;

          if (tpmEnabled === undefined) {
            return;
          }
          $scope.loading = true;
          APIUtils.saveTPMEnable(tpmVersion)
              .then(
                  function(response) {
                    $scope.originalTPMToggle = angular.copy($scope.TPMToggle);
                    $scope.originalTPMVersion = angular.copy($scope.TPMVersion);
                    toastService.success(
                        'Sucessfully updated TPM required policy.');
                  },
                  function(error) {
                    toastService.error('Unable to update TPM required policy.');
                    console.log(JSON.stringify(error));
                  })
              .finally(() => {
                $scope.loading = false;
              });
        }
      };

      loadBootSettings();
      loadTPMStatus();
    }

  ]);
})(angular);