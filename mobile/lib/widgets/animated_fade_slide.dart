import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class AnimatedFadeSlide extends StatelessWidget {
  final Widget child;
  final int index;
  final Duration delay;
  final Duration duration;
  final Offset beginOffset;

  const AnimatedFadeSlide({
    super.key,
    required this.child,
    this.index = 0,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 450),
    this.beginOffset = const Offset(0, 24),
  });

  @override
  Widget build(BuildContext context) {
    return child
        .animate()
        .fadeIn(
          duration: duration,
          delay: delay + Duration(milliseconds: index * 60),
          curve: Curves.easeOutCubic,
        )
        .slideY(
          begin: beginOffset.dy / 100,
          duration: duration,
          delay: delay + Duration(milliseconds: index * 60),
          curve: Curves.easeOutCubic,
        );
  }
}
