class CountryOption {
  final String code;
  final String name;
  final String dialCode;
  final String flag;

  const CountryOption({
    required this.code,
    required this.name,
    required this.dialCode,
    required this.flag,
  });

  factory CountryOption.fromJson(Map<String, dynamic> json) {
    return CountryOption(
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      dialCode: json['dialCode']?.toString() ?? '+237',
      flag: json['flag']?.toString() ?? '',
    );
  }

  static const fallback = CountryOption(
    code: 'CM',
    name: 'Cameroun',
    dialCode: '+237',
    flag: '🇨🇲',
  );
}

/// Construit le numéro complet comme sur la version web (Auth.tsx).
String buildFullPhone(String phone, String selectedCountryCode, List<CountryOption> countries) {
  final trimmed = phone.trim();
  if (trimmed == 'admin' || trimmed == 'commercial') return trimmed;

  CountryOption country = CountryOption.fallback;
  for (final c in countries) {
    if (c.code == selectedCountryCode) {
      country = c;
      break;
    }
  }

  final cleanPhone = trimmed.replaceFirst(RegExp(r'^\+'), '');
  final cleanDialCode = country.dialCode.replaceFirst(RegExp(r'^\+'), '');
  if (cleanPhone.startsWith(cleanDialCode)) {
    return '+$cleanPhone';
  }
  return '${country.dialCode}$cleanPhone';
}
