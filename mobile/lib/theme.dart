import 'package:flutter/material.dart';

class AppColors {
  static const background = Color(0xFFE6FAF7);
  static const backgroundCombined = Color(0xFFEEF2FF);
  static const backgroundOffline = Color(0xFFEEF2F3);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF0B2A2E);
  static const textMuted = Color(0xFF3F5B60);
  static const divider = Color(0xFFD9EEF0);
  static const border = Color(0xFF5B7B80);
  static const primary = Color(0xFF0E7490);
  static const primaryHover = Color(0xFF155E75);
  static const primaryText = Color(0xFFFFFFFF);
  static const accent = aqua;
  static const aqua = Color(0xFF22D3EE);
  static const aquaSoft = Color(0xFFA5F3FC);
  static const aquaTint = Color(0xFFCFFAFE);
  static const mintTint = Color(0xFFD1FAE5);
  static const lime = Color(0xFFBEF264);
  static const limeSoft = Color(0xFFD9F99D);
  static const limeTint = Color(0xFFECFCCB);
  static const onLime = Color(0xFF1A2E05);
  static const combinedSoft = Color(0xFFC7D2FE);
  static const combinedTint = Color(0xFFE0E7FF);
  static const danger = Color(0xFF991B1B);
  static const dangerBg = Color(0xFFFEE2E2);
  static const warning = Color(0xFF92400E);
  static const warningBg = Color(0xFFFEF3C7);
  static const info = Color(0xFF1E40AF);
  static const infoBg = Color(0xFFDBEAFE);
  static const success = Color(0xFF166534);
  static const successBg = Color(0xFFDCFCE7);
  static const neutral = Color(0xFF334155);
  static const neutralBg = Color(0xFFE2E8F0);
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.primaryText,
      primaryContainer: AppColors.aquaTint,
      onPrimaryContainer: AppColors.text,
      secondary: AppColors.aqua,
      onSecondary: AppColors.text,
      tertiary: AppColors.lime,
      onTertiary: AppColors.onLime,
      surface: AppColors.surface,
      onSurface: AppColors.text,
      error: AppColors.danger,
      onError: Colors.white,
      outline: AppColors.border,
      outlineVariant: AppColors.divider,
    ),
    scaffoldBackgroundColor: AppColors.background,
    dividerColor: AppColors.divider,
    focusColor: AppColors.infoBg,
    textTheme: const TextTheme(
      bodyLarge: TextStyle(color: AppColors.text, fontSize: 16, height: 1.5),
      bodyMedium: TextStyle(color: AppColors.text, fontSize: 14, height: 1.5),
      bodySmall: TextStyle(
        color: AppColors.textMuted,
        fontSize: 14,
        height: 1.5,
      ),
      titleLarge: TextStyle(
        color: AppColors.text,
        fontSize: 30,
        fontWeight: FontWeight.w800,
      ),
      titleMedium: TextStyle(
        color: AppColors.text,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
      titleSmall: TextStyle(
        color: AppColors.text,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
      labelLarge: TextStyle(
        color: AppColors.text,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: AppColors.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: 72,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppColors.text,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 80,
      backgroundColor: AppColors.surface,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.lime,
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topLeft: Radius.elliptical(26, 20),
          topRight: Radius.elliptical(18, 28),
          bottomRight: Radius.elliptical(28, 16),
          bottomLeft: Radius.elliptical(16, 26),
        ),
      ),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(
            color: AppColors.text,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          );
        }
        return const TextStyle(
          color: AppColors.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: AppColors.onLime);
        }
        return const IconThemeData(color: AppColors.textMuted);
      }),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryText,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryHover,
        side: const BorderSide(color: AppColors.border, width: 1.5),
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryHover,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: AppColors.lime,
      foregroundColor: AppColors.onLime,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topLeft: Radius.elliptical(26, 20),
          topRight: Radius.elliptical(18, 28),
          bottomRight: Radius.elliptical(28, 16),
          bottomLeft: Radius.elliptical(16, 26),
        ),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32), bottom: Radius.circular(24))),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.text,
      contentTextStyle: TextStyle(color: Colors.white, fontSize: 16),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
