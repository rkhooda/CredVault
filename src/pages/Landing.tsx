import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Users, Award, ExternalLink, CheckCircle, Lock, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import heroImage from "@/assets/hero-credentials.jpg";

export default function Landing() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let animationId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Convert to percentage positions (0 to 1)
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      // Create smoother, more subtle tilt based on cursor proximity to corners
      // Reduce max tilt to 8 degrees for subtlety
      const maxTilt = 8;
      
      // Calculate tilt based on distance from center, but with smoother curves - REVERSED
      const rotateY = -(xPercent - 0.5) * maxTilt * 2; // -8 to +8 degrees (reversed)
      const rotateX = (yPercent - 0.5) * maxTilt * 2; // -8 to +8 degrees (reversed)
      
      // Add subtle easing curve for smoother transitions
      const easeRotateY = rotateY * (1 - Math.abs(rotateY) / (maxTilt * 2) * 0.2);
      const easeRotateX = rotateX * (1 - Math.abs(rotateX) / (maxTilt * 2) * 0.2);
      
      // Use requestAnimationFrame for smoothest performance
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      animationId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) rotateX(${easeRotateX}deg) rotateY(${easeRotateY}deg) translateZ(20px)`;
      });
    };

    const handleMouseLeave = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
    };

    const handleMouseEnter = () => {
      // Remove any existing transition when entering for immediate response
      card.style.transition = 'box-shadow 0.3s ease-out';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    card.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
      card.removeEventListener('mouseenter', handleMouseEnter);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  const features = [
    {
      icon: Lock,
      title: "Blockchain Security",
      description: "Immutable credential storage on Polygon network with cryptographic verification."
    },
    {
      icon: Globe,
      title: "Global Verification",
      description: "Instant verification anywhere in the world with QR code scanning."
    },
    {
      icon: Award,
      title: "Institution Trust",
      description: "Verified issuers with transparent reputation tracking on-chain."
    }
  ];

  const stats = [
    { value: "50K+", label: "Verified Credentials" },
    { value: "200+", label: "Partner Institutions" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Global Access" }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-bg relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Card ref={cardRef} className="hero-card p-8 lg:p-12 relative z-10 animate-fade-in transition-all duration-500 group" style={{borderRadius: '2rem'}}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary-glow/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{borderRadius: '2rem'}}></div>
              <div className="relative z-10">
                <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
                  Own your education.
                  <br />
                  <span className="text-primary">Verify globally.</span>
                </h1>
                <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                  The first blockchain-powered platform for issuing, storing, and verifying academic credentials. 
                  Secure, transparent, and accessible anywhere in the world.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat, index) => (
                    <div key={index} className="text-center group/stat">
                      <div className="text-2xl lg:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-transform duration-300">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="relative group animate-float lg:ml-8 xl:ml-12 overflow-hidden rounded-2xl">
              <img 
                src={heroImage}
                alt="Digital credential vault with blockchain security"
                className="rounded-2xl w-full h-auto transition-all duration-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:border-2 hover:border-blue-400"
              />

              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-2xl pointer-events-none hover:from-primary/30 hover:to-accent/30 transition-all duration-500"></div>
              <div className="absolute inset-0 pointer-events-none before:content-[''] before:absolute before:inset-y-0 before:-left-full before:w-1/3 before:bg-gradient-to-tr before:from-transparent before:via-white/40 before:to-transparent before:transform before:-skew-x-12 group-hover:before:animate-shine"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose CredVault?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Built on cutting-edge blockchain technology to ensure your credentials are secure, 
              verifiable, and accessible globally.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="credential-card p-8 text-center hover:scale-105 transition-transform duration-300 cursor-pointer"
                >
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Secure Your Credentials?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of students and institutions already using blockchain-verified credentials.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="hero" size="hero" className="w-full sm:w-auto">
              <Link to="/student-portal">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="hero" className="w-full sm:w-auto">
              <a
                href="https://sepolia.etherscan.io/address/0x9b18968bF69846de101041fcb4030C02912814Ba"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                View on Sepolia Explorer
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}