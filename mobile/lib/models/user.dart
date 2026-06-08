
class User {
  final int id;
  final String? email;
  final String? phone;
  final String type;
  final String name;

  User({
    required this.id,
    this.email,
    this.phone,
    required this.type,
    required this.name,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final rawId = json['id'];
    final id = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '') ?? 0;
    final rawType = (json['type'] ?? 'standard').toString().toLowerCase();
    final type = switch (rawType) {
      'professionnel' || 'professional' || 'pharmacist' || 'pharmacien' => 'professional',
      'administrateur' || 'admin' => 'admin',
      'commercial' => 'commercial',
      _ => 'standard',
    };
    return User(
      id: id,
      email: json['email'],
      phone: json['phone'],
      type: type,
      name: json['name'] ?? 'Utilisateur',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'phone': phone,
      'type': type,
      'name': name,
    };
  }
}
