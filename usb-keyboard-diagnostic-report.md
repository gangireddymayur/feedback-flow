# External USB Keyboard Diagnostic Report

Status: Affected keyboard driver stack reinstalled successfully; controlled hardware tests and integrity checks pending  
Collected: 2026-07-18 (Asia/Calcutta)  
Computer: Dell G15 5511  
Changes made by this diagnostic session: Re-enumerated only the affected `VID_258A&PID_013B` USB/HID stack

## Executive summary

The affected device is a composite **USB Keyboard** with hardware ID `VID_258A&PID_013B`, firmware/revision `5002`. It is currently attached through the Intel PCH USB controller on root-hub high-speed port `HS04`. All of its live USB, HID, keyboard, consumer-control, mouse, system-control, and vendor-defined interfaces report `OK` with problem code 0.

After the read-only baseline, the affected USB composite parent was removed with Windows PnP and hardware was rescanned. Windows automatically rebuilt all 13 affected USB/HID child nodes from the signed Microsoft driver store. Every rebuilt node reports `OK / CM_PROB_NONE`; no driver package was deleted, and no unrelated device was removed.

The strongest actionable lead in the baseline is USB power management:

- USB selective suspend is enabled on AC and battery.
- USB 3 link power management is set to Moderate on AC and battery.
- Windows power management is enabled for both USB root hubs and both affected USB HID interfaces.

This makes power management a credible controlled-test target, but it is not yet proven to be the cause. There are no USB controller-reset events, USB/HID errors, or logged disconnect/reconnect events for the affected keyboard in the available Windows event channels.

The timing reported by the user (onset after a BIOS update) keeps BIOS involvement plausible, but current evidence does not establish it. Dell BIOS 1.43.0 is the current release, its release notes mention only a security fix, and no credible 1.43.0 USB/keyboard regression or newer corrective BIOS was found. A BIOS downgrade is not currently recommended.

## 1. System and firmware

| Item                               | Finding                                       |
| ---------------------------------- | --------------------------------------------- |
| Manufacturer                       | Dell Inc.                                     |
| Exact model                        | Dell G15 5511                                 |
| System family / SKU                | GSeries / 0A71                                |
| Baseboard                          | Dell 0746J2, revision A05                     |
| BIOS                               | Dell 1.43.0                                   |
| BIOS build date reported by SMBIOS | 2026-04-24                                    |
| Dell public release date           | 2026-06-08                                    |
| Windows                            | Windows 11 Home Single Language, version 25H2 |
| OS build                           | 26200.8875, 64-bit                            |
| Active power plan                  | Balanced                                      |

The Dell firmware driver package is `0.1.43.0`, dated 2026-04-27. Older packages 1.42.0 and 1.40.0 remain in the Windows driver store; their presence is historical and does not mean they are active.

## 2. USB controllers and root hubs

| Device                                                     | Driver provider | Driver package version | INF           | Status     |
| ---------------------------------------------------------- | --------------- | ---------------------: | ------------- | ---------- |
| Intel USB 3.10 eXtensible Host Controller, PCI `8086:9A17` | Microsoft       |        10.0.26100.8875 | `usbxhci.inf` | OK, code 0 |
| Intel USB 3.20 eXtensible Host Controller, PCI `8086:43ED` | Microsoft       |        10.0.26100.8875 | `usbxhci.inf` | OK, code 0 |
| USB Root Hub (USB 3.0), controller `9A17`                  | Microsoft       |        10.0.26100.8737 | `usbhub3.inf` | OK, code 0 |
| USB Root Hub (USB 3.0), controller `43ED`                  | Microsoft       |        10.0.26100.8737 | `usbhub3.inf` | OK, code 0 |

Both controllers use the standard Microsoft Windows xHCI stack rather than an Intel/OEM USB host-controller driver. This is normal on modern Windows.

Relevant loaded file versions:

- `hidusb.sys`: 10.0.26100.8875
- `hidclass.sys`: 10.0.26100.7920
- `kbdhid.sys`: 10.0.26100.1
- `usbccgp.sys`: 10.0.26100.8737
- `usbhub3.sys`: 10.0.26100.1
- `usbxhci.sys`: 10.0.26100.8521

Package versions and individual binary versions can differ because Windows component servicing updates files independently.

## 3. Chipset and platform drivers

| Component                           | Provider |       Version | INF          |
| ----------------------------------- | -------- | ------------: | ------------ |
| Intel HM570 LPC Controller `438B`   | Intel    |    10.1.34.13 | `oem78.inf`  |
| Intel SMBus `43A3`                  | Intel    |    10.1.34.13 | `oem78.inf`  |
| Intel Management Engine Interface   | Intel    |    2540.8.7.0 | `oem5.inf`   |
| Intel Serial IO I2C `43E8` / `43E9` | Intel    | 30.100.2104.1 | `oem69.inf`  |
| Intel HID Event Filter              | Intel    |      2.2.2.18 | `oem195.inf` |

The chipset/platform devices use Intel/OEM packages. USB host controllers and hubs use Microsoft packages.

## 4. Affected keyboard and HID stack

Bus-reported name: **USB Keyboard**  
USB hardware ID: `USB\VID_258A&PID_013B&REV_5002`  
Current composite instance: `USB\VID_258A&PID_013B\5&3A098C8F&0&4`  
Current path: `PCIROOT(0)#PCI(1400)#USBROOT(0)#USB(4)` / ACPI `XHCI/RHUB/HS04`

| Layer                              | Service / INF                        | Provider  |                          Version | Status |
| ---------------------------------- | ------------------------------------ | --------- | -------------------------------: | ------ |
| USB composite parent               | `usbccgp` / `usb.inf`                | Microsoft |                  10.0.26100.8737 | OK     |
| USB HID interfaces MI_00 and MI_01 | `HidUsb` / `input.inf`               | Microsoft |                  10.0.26100.8875 | OK     |
| Two keyboard collections           | `kbdhid` / `keyboard.inf`            | Microsoft |                  10.0.26100.8521 | OK     |
| Consumer-control collection        | `hidserv.inf`                        | Microsoft |                     10.0.26100.1 | OK     |
| Other HID collections              | `input.inf` or standard HID services | Microsoft | 10.0.26100.8875 where applicable | OK     |

The keyboard exposes two keyboard collections plus consumer, mouse, system-control, and vendor-defined HID collections. That is a normal pattern for a feature-rich composite keyboard and is not evidence of duplicate installation.

The keyboard class has only the standard `kbdclass` upper filter and no lower filter. No third-party keyboard class filter is installed.

A Logitech G HUB virtual keyboard is present and G HUB is running, but it is a separate `VID_046D&PID_C232` virtual device. No evidence currently shows that it is duplicating this physical keyboard's input.

## 5. Device Manager health

No present USB controller, root hub, USB composite device, USB input device, affected HID collection, or keyboard device has a warning or nonzero problem code.

Some present Intel XTU software-component nodes and Microsoft Hypervisor Service show the PowerShell status label `Degraded`, but all have `CM_PROB_NONE`. They are not in the affected USB/HID path and are not evidence for this keyboard fault.

Historical/non-present (`CM_PROB_PHANTOM`) devices include an old generic USB hub and one old `Unknown USB Device (Device Descriptor Request Failed)`. Those are not currently attached and cannot be tied to this keyboard from the collected evidence.

## 6. Event Viewer and reconnect evidence

Period checked: last 60 days.

- No System-log warning or error references `VID_258A`, `PID_013B`, `USBHUB3`, `USBXHCI`, either live root hub, or either USB host controller.
- The enabled `Microsoft-Windows-USB-USBXHCI-Operational` log contains zero events.
- Other enabled USB/HID operational logs inspected also contain zero events.
- No USB controller reset was found.
- No Windows event establishes repeated disconnect/reconnect of the affected keyboard.
- Repeated Kernel-PnP event 219 warnings concern Intel Dynamic Tuning / Detection Verification (`WUDFRd`, status `0xC0000365`), not the keyboard or USB controller.
- Kernel-Power event 41 records several unclean restarts, but none identify USB or HID as the cause.

The SetupAPI device-install log records a manual Device Manager uninstall of only the affected MI_00 keyboard node at 19:14:55 on 2026-07-18. Windows successfully re-enumerated it at 19:16:17. This action predated this diagnostic session.

After explicit user authorization and administrator elevation, this diagnostic session later removed the single affected composite parent `USB\VID_258A&PID_013B\5&3A098C8F&0&4` and ran a PnP hardware scan. The removal and scan both succeeded. Windows rebuilt the composite parent, two USB Input Device interfaces, two keyboard collections, and the associated consumer/system/vendor/mouse collections. All 13 nodes are healthy, and the System log contains no USB, HID, or Kernel-PnP warning/error from the operation.

Historical enumeration proves that this same keyboard has been recognized at four USB topology locations:

| USB path            | First/current install evidence                |
| ------------------- | --------------------------------------------- |
| PCH root hub `HS01` | Seen 2026-06-26                               |
| PCH root hub `HS03` | First seen 2025-08-28; reinstalled 2026-05-17 |
| PCH root hub `HS04` | First seen 2025-08-28; currently attached     |
| PCH root hub `HS06` | Seen 2026-07-12                               |

This shows successful enumeration at four logical ports, including multiple Type-A/topology locations, but it does not record whether missed/double keys occurred at each port. A controlled port-by-port functional test is still required.

## 7. Power management

| Setting                         | AC                     | Battery                |
| ------------------------------- | ---------------------- | ---------------------- |
| USB selective suspend           | Enabled                | Enabled                |
| Hub selective-suspend timeout   | 50 ms                  | 50 ms                  |
| USB 3 link power management     | Moderate power savings | Moderate power savings |
| IOC on all transfer descriptors | Enabled                | Disabled               |

WMI reports device power management enabled (`MSPower_DeviceEnable=True`) for:

- Both USB Root Hub (USB 3.0) devices
- The affected keyboard's MI_00 USB HID interface
- The affected keyboard's MI_01 USB HID interface

This corresponds to Windows being allowed to manage/turn off these USB devices. It is a valid hypothesis for intermittent input loss after idle/power transitions, but it does not by itself explain duplicate keystrokes and must be tested by changing one variable at a time.

## 8. Windows keyboard configuration

| Check                  | Finding                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Filter Keys            | Off (`Flags=114`, on-bit not set)                                  |
| Sticky Keys            | Off (`Flags=498`, on-bit not set)                                  |
| Toggle Keys            | Off (`Flags=50`, on-bit not set)                                   |
| Keyboard repeat delay  | Registry value 1                                                   |
| Keyboard repeat speed  | 31 (fastest)                                                       |
| Filter-key bounce time | 0; inactive because Filter Keys is off                             |
| Layouts                | English (India) and English (United States), both using `00004009` |
| Keyboard class filters | Standard `kbdclass` only                                           |

No incorrect accessibility, language, registry repeat, or keyboard-filter configuration was found. No configuration correction has been made.

## 9. BIOS investigation

Dell's current public package for this model is BIOS 1.43.0, driver ID `2X6Y1`, released 2026-06-08. The installed machine is already on 1.43.0.

Dell's stated change is the security update in DSA-2026-195. The release notes do not mention USB, HID, keyboard timing, xHCI, or power-management changes. Dell states that after 1.43.0 the system cannot downgrade to 1.40.0 or earlier. No newer BIOS was found.

The search found no credible Dell advisory, release note, or well-supported report establishing a USB keyboard regression in BIOS 1.43.0. Therefore:

- BIOS causality remains possible based on the user's timing, not confirmed.
- There is no newer BIOS fix to apply.
- Automatic downgrade is prohibited by the task and is not recommended from current evidence.
- A rollback to 1.42.0 or 1.41.0 should only be considered later with Dell support guidance and stronger A/B evidence, because firmware flashing has material risk and 1.43.0 contains a critical security fix.

Official sources:

- Dell BIOS 1.43.0 package: https://www.dell.com/support/home/en-us/drivers/driversdetails?driverid=2X6Y1
- Dell DSA-2026-195: https://www.dell.com/support/kbdoc/en-us/000452197/dsa-2026-195

## 10. Dell utilities

Installed:

- Dell SupportAssist 5.1.1.3567
- Dell Update for Windows Universal 5.5.0 / UWP package 5.5.23.0
- Dell SupportAssist Remediation 5.5.14.0
- Dell Client Management Service
- Alienware Command Center 5.9.2.0

The services are running. Existing logs confirm the SupportAssist driver-update plugin loads, but no readable cached result was found that proves whether a chipset/firmware update is pending. A fresh vendor scan remains pending.

## 11. Polling-rate assessment

Windows PnP inventory does not expose this keyboard's HID interrupt endpoint interval, and the current event logs do not record per-keystroke timestamps. Therefore an abnormal polling rate cannot be claimed or excluded from this baseline.

A controlled key-event trace or USB protocol trace is required. The lower-risk first test is a key-event timing test while the user presses one key at a time; a USB protocol capture is only warranted if the timing test indicates duplicated hardware reports.

## 12. Other-keyboard comparison

No second physical external keyboard is currently present. The other keyboard nodes are the built-in PS/2 keyboard, system/converted input devices, a webcam-associated HID collection, and the Logitech G HUB virtual keyboard. A real second external keyboard comparison remains pending.

## 13. Integrity checks

Pending administrator elevation:

- `sfc /scannow`
- `DISM /Online /Cleanup-Image /RestoreHealth`

These commands have not been run because this VS Code/PowerShell session is not elevated.

## 14. Preliminary diagnosis

This is not the final root-cause determination.

| Candidate                             | Current likelihood               | Evidence                                                                                              |
| ------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Windows USB power management          | Plausible / leading test target  | Selective suspend and USB 3 link power savings enabled; root hubs and HID interfaces power-manageable |
| BIOS regression                       | Plausible but unproven           | User reports onset after BIOS update; no release-note or event evidence; current BIOS is latest       |
| Windows USB/HID driver corruption     | Lower after clean re-enumeration | Standard signed Microsoft stack, all nodes healthy, recent successful keyboard-node reinstall         |
| USB controller/chipset fault          | Possible but unsupported so far  | Works only on this laptop, but no controller errors/resets and device enumerates on four paths        |
| Keyboard hardware fault               | Lower                            | User reports it works on other computers                                                              |
| Accessibility/repeat/language setting | Unlikely                         | Settings are normal/off                                                                               |
| Third-party input software            | Low but testable                 | G HUB virtual keyboard exists; no third-party keyboard class filter or direct evidence                |

Current confidence in the leading hypothesis: **Low to Medium**, pending controlled tests.

## 15. Pending controlled tests and safe sequence

1. Monitor the currently attached keyboard for disconnect/reconnect while reproducing the fault.
2. Record key-down/up timing for deliberate single presses to distinguish duplicated input reports from Windows text repeat.
3. Repeat the same short typing test on every physical USB port and record port-specific results.
4. Repeat with another known-good physical USB keyboard.
5. Run once with Logitech G HUB fully exited to exclude virtual-input software.
6. With authorization/elevation, run SFC and DISM.
7. If the fault persists, disable USB selective suspend and USB 3 link power management as a reversible A/B test, then retest. Do not simultaneously reinstall controllers or chipset drivers.
8. Run a fresh Dell Update/SupportAssist scan and record only relevant BIOS, chipset, Intel ME, Serial IO, HID, Thunderbolt, or firmware recommendations.
9. Reinstall USB controller/chipset packages only if evidence remains after the isolated power test or the OEM scan identifies an applicable update.

## Change log

- Removed only the affected composite USB device node `USB\VID_258A&PID_013B\5&3A098C8F&0&4`.
- Ran `pnputil /scan-devices`; Windows automatically reinstalled/re-enumerated all 13 affected child nodes.
- Reused the installed signed Microsoft packages: `usb.inf`, `input.inf`, `keyboard.inf`, and `hidserv.inf`.
- No driver package was deleted or updated.
- No unrelated keyboard, HID device, USB device, root hub, host controller, or chipset device was removed.
- No power or accessibility setting has yet been changed.
- No BIOS change made.
- One Markdown report created in the workspace.
