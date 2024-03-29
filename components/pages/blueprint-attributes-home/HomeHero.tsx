import Image from "next/image";
import Link from "next/link";
import { HeroText, SectionSubtext } from "../home-shared/Headings";
import { Gradient } from "../home-shared/Gradient";
import { FadeIn } from "../home-shared/FadeIn";
import { CTAButton } from "../home-shared/CTAButton";
import { useConfig } from "nextra-theme-docs";

export function HomeHero() {
  const config = useConfig();

  const gradientColorProps = {
    blue: true,
  };

  return (
    <>
      <FadeIn
        noVertical
        className="font-sans w-auto pb-16 md:pb-24 lg:pb-32 flex justify-between gap-8 items-center flex-col relative z-0"
      >
        <FadeIn className="z-50 flex items-center justify-center w-full ">

          <div className="absolute z-50 flex items-center justify-center w-64 h-64">
            <Gradient
              small
              width={120}
              height={120}
              className="dark:opacity-100 opacity-40"
              {...gradientColorProps}
            />
          </div>

          <div className="z-50 -mt-10">
            <Image
              alt=""
              src={`/img/Logo-White-Transparent.png`}
              width={512}
              height={512}
              className="hidden dark:block"
            />

            <Image
              alt=""
              src={`/img/Logo-Black-Transparent.png`}
              width={512}
              height={512}
              className="block dark:hidden"
            />
          </div>
        </FadeIn>
        <Gradient
          width={1000}
          height={1000}
          className="top-[-500px] dark:opacity-20 opacity-[0.15]"
          {...gradientColorProps}
        />
        <div className="absolute top-0 z-10 w-full h-48 dark:from-black from-white to-transparent bg-gradient-to-b" />
        <FadeIn
          delay={0.15}
          className="z-50 flex flex-col items-center justify-center gap-5 px-6 text-center lg:gap-6 -mt-20"
        >
          {/* <RepoLogo
            alt="BlueprintAttributes"
            width="200"
            className="w-[160px] md:w-[200px] fill-black dark:fill-white"
          /> */}
          <HeroText h1>Attribute Sets in Blueprints</HeroText>
          <SectionSubtext hero>
            Blueprint Attributes is a plugin extension for GAS (Gameplay Ability System), fully exposing Gameplay Attributes and Attribute Sets to Blueprints.
          </SectionSubtext>
        </FadeIn>
        <FadeIn
          delay={0.3}
          className="z-50 flex flex-col items-center w-full max-w-md gap-5 px-6"
        >
          <div className="flex flex-col w-full gap-3 md:!flex-row">
            <CTAButton>
              <Link href="/docs" className="block py-3">
                Get Started
              </Link>
            </CTAButton>
            
            <CTAButton outline>
              <a
                target="_blank"
                rel="noreferrer"
                href={config.project.link}
                className="block py-3"
              >
                Unreal Marketplace
              </a>
            </CTAButton>
          </div>
        </FadeIn>
        <FadeIn delay={0.5} className="relative w-full">
          <div className="absolute bottom-0 w-full dark:from-black from-white to-transparent h-72 bg-gradient-to-t" />
        </FadeIn>
      </FadeIn>
    </>
  );
}
