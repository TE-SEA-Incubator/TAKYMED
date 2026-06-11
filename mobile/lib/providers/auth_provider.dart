
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  bool _isLoading = false;
  bool _isInitialized = false;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  bool get isInitialized => _isInitialized;

  AuthProvider() {
    _loadUserFromPrefs();
  }

  Future<void> _loadUserFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('user');
    if (userJson != null) {
      _user = User.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
    }
    _isInitialized = true;
    notifyListeners();
  }

  Future<bool> login(String phone, String type, String pin, ApiService apiService) async {
    _isLoading = true;
    notifyListeners();

    try {
      final userData = await apiService.login(phone, type, pin);
      _user = User.fromJson(userData);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(_user!.toJson()));

      notifyListeners();
      return true;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user');
    notifyListeners();
  }

  Future<void> updateUser(String name, String phone, {String? email}) async {
    _user = User(
      id: _user!.id,
      email: email ?? _user!.email,
      phone: phone,
      type: _user!.type,
      name: name,
    );
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user', jsonEncode(_user!.toJson()));
    
    notifyListeners();
  }
}
