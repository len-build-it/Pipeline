import 'package:flutter/material.dart';
import 'data/synthetic_data.dart';
import 'screens/home_shell.dart';
import 'theme.dart';

void main() {
  runApp(const AqOneDevGuildApp());
}

class AqOneDevGuildApp extends StatefulWidget {
  final SyntheticDataRepository? initialRepo;

  const AqOneDevGuildApp({super.key, this.initialRepo});

  @override
  State<AqOneDevGuildApp> createState() => _AqOneDevGuildAppState();
}

class _AqOneDevGuildAppState extends State<AqOneDevGuildApp> {
  late final SyntheticDataRepository _repo;

  @override
  void initState() {
    super.initState();
    _repo = widget.initialRepo ?? SyntheticDataRepository();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AqOne & Dev Guild Manager',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: HomeShell(repo: _repo),
    );
  }
}
