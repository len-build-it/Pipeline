import 'package:flutter/material.dart';
import 'data/synthetic_data.dart';
import 'screens/home_shell.dart';
import 'theme.dart';

void main() {
  runApp(const TeamManagerApp());
}

class TeamManagerApp extends StatefulWidget {
  final SyntheticDataRepository? initialRepo;

  const TeamManagerApp({super.key, this.initialRepo});

  @override
  State<TeamManagerApp> createState() => _TeamManagerAppState();
}

class _TeamManagerAppState extends State<TeamManagerApp> {
  late final SyntheticDataRepository _repo;

  @override
  void initState() {
    super.initState();
    _repo = widget.initialRepo ?? SyntheticDataRepository();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Team Manager',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: HomeShell(repo: _repo),
    );
  }
}
