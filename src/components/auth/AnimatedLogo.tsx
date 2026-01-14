import logoBEG from "@/assets/logoBEG.png";

const AnimatedLogo = () => {
  return (
    <div className="relative mb-8">
      <img 
        src={logoBEG} 
        alt="BEG Inovação" 
        className="h-20 animate-fade-in"
      />
    </div>
  );
};

export default AnimatedLogo;
