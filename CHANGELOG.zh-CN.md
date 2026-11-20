---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.1.1"
locale: "zh-CN"
---
# Changelog

## [1.1.1]

### Changed

- README 说明加价方法：把表达式里的每个单价分别乘以倍率。在整条表达式末尾追加 `* 1.2` 照样能正确扣费，但网关模型页会显示原始表达式，不再显示价格表。
