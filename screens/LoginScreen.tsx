import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  StatusBar,
  ScrollView,
} from 'react-native';

declare var require: any;

const LoginScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFD" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logoText}>Jobizz</Text>
          <Text style={styles.welcomeText}>Welcome Back 👋</Text>
          <Text style={styles.subText}>Let’s log in. Apply to jobs!</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#AFB0B6"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#AFB0B6"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#AFB0B6"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => {}}>
             <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Home')}>
            <Text style={styles.loginButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.socialContainer}>
          <TouchableOpacity style={styles.socialButton}>
            <Image
              source={require('../assets/apple.png')}
              style={styles.socialIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Image
              source={require('../assets/google.png')}
              style={styles.socialIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Image
              source={require('../assets/facebook.png')}
              style={styles.socialIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Haven't an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerText}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFD',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#356899',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0D0D26',
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    color: '#AFB0B6',
  },
  formContainer: {
    marginBottom: 30,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#AFB0B6',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    fontSize: 14,
    marginBottom: 16,
    color: '#0D0D26',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end', 
    marginBottom: 24,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#356899', 
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#356899',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#356899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#AFB0B6',
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#AFB0B6',
    fontSize: 13,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 40,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28, 
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIcon: {
    width: 24,
    height: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#BDBEC2',
    fontSize: 14,
  },
  registerText: {
    color: '#356899',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;