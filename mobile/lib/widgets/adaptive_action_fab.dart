import 'package:flutter/material.dart';

class AdaptiveActionFab extends StatelessWidget {
  final Key? buttonKey;
  final Object heroTag;
  final String label;
  final Widget icon;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final ShapeBorder? shape;

  const AdaptiveActionFab({
    super.key,
    this.buttonKey,
    required this.heroTag,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.shape,
  });

  @override
  Widget build(BuildContext context) {
    final largeText = MediaQuery.textScalerOf(context).scale(1) > 1.3;
    if (largeText) {
      return FloatingActionButton(
        key: buttonKey,
        heroTag: heroTag,
        tooltip: label,
        onPressed: onPressed,
        backgroundColor: backgroundColor,
        foregroundColor: foregroundColor,
        shape: shape,
        child: icon,
      );
    }

    return FloatingActionButton.extended(
      key: buttonKey,
      heroTag: heroTag,
      onPressed: onPressed,
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      shape: shape,
      icon: icon,
      label: Text(label),
    );
  }
}
